// @actions/core actions 的核心库, 会被默认包含
const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const { Toolkit } = require("actions-toolkit");

const { commitFile } = require("./utils/commit");
const { toUrlFormat } = require("./utils/markdown");
const { formatDate } = require("./utils/time");

// Get config
const CUSTOM_CONFIG = core.getInput("CUSTOM_CONFIG");
const GH_REPOS = core.getInput("GH_REPOS");
const GH_USERNAMES = core.getInput("GH_USERNAMES");
const COMMIT_NAME = core.getInput("COMMIT_NAME");
const COMMIT_EMAIL = core.getInput("COMMIT_EMAIL");
const COMMIT_MSG = core.getInput("COMMIT_MSG");
const MAX_LINES = core.getInput("MAX_LINES");
const TARGET_FILE = core.getInput("TARGET_FILE");

core.info(CUSTOM_CONFIG);

/**
 * 首字母大写
 * @param {String} str - the string
 *
 * @returns {String}
 */
const capitalize = (str) => str.slice(0, 1).toUpperCase() + str.slice(1);

const serializers = {
  IssueCommentEvent: (item) => {
    // core.info("IssueCommentEvent");
    // core.info(JSON.stringify(item, null, 2));
    return `🗣 Commented on ${toUrlFormat(item)}  in ${toUrlFormat(
      item.repo.name
    )} at ${formatDate(item.created_at)}`;
  },
  IssuesEvent: (item) => {
    // core.info("IssuesEvent");
    // core.info(JSON.stringify(item, null, 2));
    const emoji = item.payload.action === "opened" ? "❗" : "🔒";
    return `${emoji} ${capitalize(item.payload.action)} issue ${toUrlFormat(
      item
    )}  in ${toUrlFormat(item.repo.name)} at ${formatDate(item.created_at)}`;
  },
  PullRequestEvent: (item) => {
    // core.info("PullRequestEvent");
    // core.info(JSON.stringify(item, null, 2));
    const emoji = item.payload.action === "opened" ? "💪" : "❌";
    const line = item.payload.pull_request.merged
      ? "🎉 Merged"
      : `${emoji} ${capitalize(item.payload.action)}`;
    return `${line} PR ${toUrlFormat(item)}  in ${toUrlFormat(
      item.repo.name
    )} at ${formatDate(item.created_at)}`;
  },
  ReleaseEvent: (item) => {
    // core.info("ReleaseEvent");
    // core.info(JSON.stringify(item, null, 2));
    return `🚀 ${capitalize(item.payload.action)} release ${toUrlFormat(
      item
    )} in ${toUrlFormat(item.repo.name)} at ${formatDate(item.created_at)}`;
  },
};

Toolkit.run(
  async (tools) => {
    const users = GH_USERNAMES.split(",").map((s) => s.trim());
    const repos = GH_REPOS.split(",").map((s) => s.trim());
    // 最好的处理方式是矩阵 martrix
    tools.log.debug(`共有 ${users.length} 个用户活动需要监听，分别是 ${users}`);

    const getActivitiesByUserName = async (username) => {
      // Get the user's public events
      tools.log.debug(`Getting activity for ${username}`);
      // 通过这个方式获取的数据，应该只有 90 天以内的。
      const events = await tools.github.activity.listPublicEventsForUser({
        username: username,
        per_page: 1000,
      });
      tools.log.debug(
        `Activity for ${username}, ${events.data.length} events found.`
      );

      // 根据仓库和作者进行过滤排序
      const rowContent = events.data
        // Filter out any boring activity
        .filter((event) => serializers.hasOwnProperty(event.type))
        // We only have five lines to work with
        .slice(0, MAX_LINES)
        // Call the serializer to construct a string
        .map((item) => ({
          text: serializers[item.type](item),
          repo: item.repo,
          repoName: item.repo.name,
          actor: item.actor,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }))
        // 只保留指定仓库
        .filter((item) => repos.includes(item.repoName))
        .sort((a, b) => (a.created_at - b.created_at > 0 ? -1 : 1));

      const tempMap = {};
      rowContent.forEach((item) => {
        const { repoName } = item;
        if (!tempMap[repoName]) {
          tempMap[repoName] = [];
        }
        tempMap[repoName].push(item.text);
      });

      const content = [`${username}'s activity: `];
      Object.keys(tempMap).forEach((repoName) => {
        content.push(toUrlFormat(repoName));
        content.push(...tempMap[repoName]);
        content.push("");
      });

      if (!rowContent.length) {
        tools.exit.success(
          "No PullRequest/Issue/IssueComment/Release events found. Leaving README unchanged with previous activity"
        );
      }

      if (rowContent.length < 5) {
        tools.log.info("Found less than 5 activities");
      }

      return content;
    };

    const content = (
      await Promise.all(users.map(getActivitiesByUserName))
    ).flat(Infinity);
    core.info(content);

    const readmeContent = fs
      .readFileSync(`./${TARGET_FILE}`, "utf-8")
      .split("\n");

    // Find the index corresponding to <!--START_SECTION:activity--> comment
    let startIdx = readmeContent.findIndex(
      (content) => content.trim() === "<!--START_SECTION:activity-->"
    );

    // Early return in case the <!--START_SECTION:activity--> comment was not found
    if (startIdx === -1) {
      return tools.exit.failure(
        `Couldn't find the <!--START_SECTION:activity--> comment. Exiting!`
      );
    }

    // Find the index corresponding to <!--END_SECTION:activity--> comment
    const endIdx = readmeContent.findIndex(
      (content) => content.trim() === "<!--END_SECTION:activity-->"
    );

    if (startIdx !== -1 && endIdx === -1) {
      // Add one since the content needs to be inserted just after the initial comment
      startIdx++;
      content.forEach(
        (line, idx) =>
          readmeContent.splice(startIdx + idx, 0, `${idx + 1}. ${line}`) // 格式在前面处理
      );

      // Append <!--END_SECTION:activity--> comment
      readmeContent.splice(
        startIdx + content.length,
        0,
        "<!--END_SECTION:activity-->"
      );

      // Update README
      fs.writeFileSync(`./${TARGET_FILE}`, readmeContent.join("\n"));

      // core.info(readmeContent.join("\n"));

      // TODO:
      // Commit to the remote repository
      try {
        await commitFile(COMMIT_EMAIL, COMMIT_NAME, TARGET_FILE, COMMIT_MSG);
      } catch (err) {
        tools.log.debug("Something went wrong");
        return tools.exit.failure(err);
      }
      tools.exit.success("Wrote to README");
    }

    const oldContent = readmeContent.slice(startIdx + 1, endIdx).join("\n");
    const newContent = content
      .map((line, idx) => `${idx + 1}. ${line}`)
      .join("\n");

    if (oldContent.trim() === newContent.trim())
      tools.exit.success("No changes detected");

    startIdx++;

    // Recent GitHub Activity content between the comments
    const readmeActivitySection = readmeContent.slice(startIdx, endIdx);
    if (!readmeActivitySection.length) {
      content.some((line, idx) => {
        // User doesn't have 5 public events
        if (!line) {
          return true;
        }
        readmeContent.splice(startIdx + idx, 0, `${idx + 1}. ${line}`);
      });
      tools.log.success(`Wrote to ${TARGET_FILE}`);
    } else {
      // It is likely that a newline is inserted after the <!--START_SECTION:activity--> comment (code formatter)
      let count = 0;

      readmeActivitySection.some((line, idx) => {
        // User doesn't have 5 public events
        if (!content[count]) {
          return true;
        }
        if (line !== "") {
          readmeContent[startIdx + idx] = `${count + 1}. ${content[count]}`;
          count++;
        }
      });
      tools.log.success(`Updated ${TARGET_FILE} with the recent activity`);
    }

    // Update README
    fs.writeFileSync(`./${TARGET_FILE}`, readmeContent.join("\n"));
    // core.info(readmeContent.join("\n"));

    // Commit to the remote repository
    try {
      await commitFile(COMMIT_EMAIL, COMMIT_NAME, TARGET_FILE, COMMIT_MSG);
    } catch (err) {
      tools.log.debug("Something went wrong");
      return tools.exit.failure(err);
    }
    tools.exit.success("Pushed to remote repository");
  },
  {
    event: ["schedule", "workflow_dispatch", "push"],
    secrets: ["GITHUB_TOKEN"],
  }
);
