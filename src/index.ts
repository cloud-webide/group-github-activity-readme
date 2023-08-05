// @actions/core actions 的核心库, 会被默认包含
import * as core from '@actions/core';
import { Toolkit } from 'actions-toolkit';
import { spawn } from 'child_process';
import * as fs from 'fs';
import getIssues, { IState } from './api/issue';

// Get config
// const GH_REPOS = 'microsoft/vscode-test-web';
// const GH_USERNAMES = 'yiliang114';
// const TARGET_FILE = 'README.md';
// const DEFAULT_PAGE = '1';
// const DEFAULT_PER_PAGE = '5';
// const DEFAULT_STATE: IState = 'all';

const COMMIT_NAME = core.getInput('COMMIT_NAME');
const COMMIT_EMAIL = core.getInput('COMMIT_EMAIL');
const COMMIT_MSG = core.getInput('COMMIT_MSG');
// const MAX_LINES = core.getInput('MAX_LINES');

const GH_REPOS = core.getInput('GH_REPOS');
const GH_USERNAMES = core.getInput('GH_USERNAMES');
const TARGET_FILE = core.getInput('TARGET_FILE');
const DEFAULT_PAGE = core.getInput('DEFAULT_PAGE');
const DEFAULT_PER_PAGE = core.getInput('DEFAULT_PER_PAGE');
const DEFAULT_STATE = core.getInput('DEFAULT_STATE');

/**
 * 首字母大写
 * @param {String} str - the string
 *
 * @returns {String}
 */
const capitalize = (str: string) => str.slice(0, 1).toUpperCase() + str.slice(1);

/**
 * 获取时间（日期）
 * 2023-07-28T16:08:22Z => 2023-07-28
 * @param {String} str - the string
 *
 * @returns {String}
 */
const getDate = (str: string) => {
  const res = str.match(/^(\d+-\d+-\d+)/);
  if (res) {
    return res[0];
  }
  return res;
};

/**
 * 返回 markdown 形式的链接
 * Returns a URL in markdown format for PR's and issues
 * @param {Object | String} item - holds information concerning the issue/PR
 *
 * @returns {String}
 */
const toUrlFormat = (item: any) => {
  if (typeof item !== 'object') {
    return `[${item}](https://github.com/${item})`;
  }
  // 只剩这两个事件了。
  if (Object.hasOwnProperty.call(item.payload, 'issue')) {
    const title = `${item.payload.issue?.title} #${item.payload.issue.number}`.trim();
    core.info(`issue: ${title}`);
    return `[${title}](${item.payload.issue.html_url})`;
  }
  if (Object.hasOwnProperty.call(item.payload, 'pull_request')) {
    const title = `${item.payload.pull_request?.title} #${item.payload.pull_request.number}`.trim();
    core.info(`pull_request: ${title}`);
    return `[${title}](${item.payload.pull_request.html_url})`;
  }
};

/**
 * Execute shell command
 * @param {String} cmd - root command
 * @param {String[]} args - args to be passed along with
 *
 * @returns {Promise<void>}
 */

const exec = (cmd: string, args: string[] = []) =>
  new Promise((resolve, reject) => {
    const app = spawn(cmd, args, { stdio: 'pipe' });
    let stdout = '';
    app.stdout.on('data', data => {
      stdout = data;
    });
    app.on('close', code => {
      if (code !== 0 && !stdout.includes('nothing to commit')) {
        const err = new Error(`Invalid status code: ${code}`);
        (err as any).code = code;
        return reject(err);
      }
      return resolve(code);
    });
    app.on('error', reject);
  });

/**
 * Make a commit 提交代码
 *
 * @returns {Promise<void>}
 */
const commitFile = async () => {
  await exec('git', ['config', '--global', 'user.email', COMMIT_EMAIL]);
  await exec('git', ['config', '--global', 'user.name', COMMIT_NAME]);
  await exec('git', ['add', TARGET_FILE]);
  await exec('git', ['commit', '-m', COMMIT_MSG]);
  await exec('git', ['push']);
};

const serializers = {
  issues: (item: any) => {
    const statusDesc = item.state === 'open' ? 'still in Open ❗' : 'had been Close 🔒';
    // ${capitalize(item.state)}
    return `${toUrlFormat({
      payload: {
        issue: item,
      },
    })} ${statusDesc} at ${getDate(item.created_at)} `;
  },
  pullRequests: (item: any) => {
    const emoji = item.state === 'open' ? 'still in Open 💪' : 'had been Closed ❌';
    const statusDesc = !!item.pull_request.merged_at ? 'had been Merged 🎉' : `${capitalize(item.state)} ${emoji} `;
    return `${toUrlFormat({
      payload: {
        pull_request: item,
      },
    })} ${statusDesc} at ${getDate(item.created_at)}`;
  },
};

Toolkit.run(
  async tools => {
    const users = GH_USERNAMES.split(',').map(user => user.trim());
    const namespaces = GH_REPOS.split(',').map(user => user.trim());
    // 最好的处理方式是矩阵 Matrix
    tools.log.debug(`共有 ${users.length} 个用户活动需要监听，分别是 ${users}`);

    let newContents = [];
    for (const user of users) {
      for (const namespace of namespaces) {
        const [owner, repo] = namespace.split('/');
        const repoName = `${owner}/${repo}`;

        //  Get the user's public events
        tools.log.debug(`Getting activity for ${user} in ${repoName}.`);
        const { issues = [], pullRequests = [] } = await getIssues({
          owner,
          repo,
          creator: user,
          page: parseInt(DEFAULT_PAGE),
          per_page: parseInt(DEFAULT_PER_PAGE),
          state: DEFAULT_STATE as IState,
          // TODO:
          // since: '2021-01-01T00:00:00Z',
        });

        tools.log.debug(
          `Activity for ${user} in ${repoName}, ${issues.length} issues found, ${pullRequests.length} pullRequests found.`,
        );

        newContents.push(
          `## ${user} in [${repoName}](https://github.com/${repoName})`,
          '\n',
          `### Issue List: `,
          ...issues.map((item: any, index: number) => {
            // tools.log.debug(`Issue ===== ${index}: `, JSON.stringify(item, null, 2));
            return `${index + 1}. ${serializers.issues(item)}`;
          }),
          '\n',
          `### PR List: `,
          ...pullRequests.map((item: any, index: number) => {
            // tools.log.debug(`PR ===== ${index}: `, JSON.stringify(item, null, 2));
            return `${index + 1}. ${serializers.pullRequests(item)}`;
          }),
          '\n',
        );

        // core.info('Activity Content: ');
        // core.info(newContents.join('\n'));
      }
    }

    const readmeContent = fs.readFileSync(`./${TARGET_FILE}`, 'utf-8').split('\n');

    // Find the index corresponding to <!--START_SECTION:activity--> comment
    let startIdx = readmeContent.findIndex(content => content.trim() === '<!--START_SECTION:activity-->');

    // Early return in case the <!--START_SECTION:activity--> comment was not found
    if (startIdx === -1) {
      return tools.exit.failure(`Couldn't find the <!--START_SECTION:activity--> comment. Exiting!`);
    }

    // Find the index corresponding to <!--END_SECTION:activity--> comment
    const endIdx = readmeContent.findIndex(content => content.trim() === '<!--END_SECTION:activity-->');

    if (!newContents.length) {
      tools.exit.success(
        'No PullRequest/Issue/IssueComment/Release events found. Leaving README unchanged with previous activity',
      );
    }

    newContents = [...readmeContent.slice(0, startIdx - 1), ...newContents, ...readmeContent.slice(endIdx)];

    // Update README
    fs.writeFileSync(`./${TARGET_FILE}`, newContents.join('\n'));
    tools.log.debug('Wrote to README');

    // Commit to the remote repository
    try {
      await commitFile();
    } catch (err: any) {
      tools.log.debug('Something went wrong');
      return tools.exit.failure(err);
    }
    tools.exit.success('Pushed to remote repository');
  },
  {
    event: ['schedule', 'workflow_dispatch', 'push'],
    secrets: ['GITHUB_TOKEN'],
  },
);
