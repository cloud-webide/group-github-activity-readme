// @actions/core actions 的核心库, 会被默认包含
import * as core from "@actions/core";
import { Toolkit } from "actions-toolkit";
import { spawn } from "child_process";
import * as fs from "fs";

// Get config
const GH_REPOS = core.getInput("GH_REPOS");
const GH_USERNAMES = core.getInput("GH_USERNAMES");
const COMMIT_NAME = core.getInput("COMMIT_NAME");
const COMMIT_EMAIL = core.getInput("COMMIT_EMAIL");
const COMMIT_MSG = core.getInput("COMMIT_MSG");
const MAX_LINES = core.getInput("MAX_LINES");
const TARGET_FILE = core.getInput("TARGET_FILE");

core.info(GH_REPOS);

/**
 * 首字母大写
 * @param {String} str - the string
 *
 * @returns {String}
 */
const capitalize = (str: string) =>
  str.slice(0, 1).toUpperCase() + str.slice(1);

/**
 * 返回 markdown 形式的链接
 * Returns a URL in markdown format for PR's and issues
 * @param {Object | String} item - holds information concerning the issue/PR
 *
 * @returns {String}
 */
const toUrlFormat = (item: any) => {
  if (typeof item !== "object") {
    return `[${item}](https://github.com/${item})`;
  }
  if (Object.hasOwnProperty.call(item.payload, "comment")) {
    return `[#${item.payload.issue.number}](${item.payload.comment.html_url})`;
  }
  if (Object.hasOwnProperty.call(item.payload, "issue")) {
    return `[#${item.payload.issue.number}](${item.payload.issue.html_url})`;
  }
  if (Object.hasOwnProperty.call(item.payload, "pull_request")) {
    return `[#${item.payload.pull_request.number}](${item.payload.pull_request.html_url})`;
  }

  if (Object.hasOwnProperty.call(item.payload, "release")) {
    const release = item.payload.release.name || item.payload.release.tag_name;
    return `[${release}](${item.payload.release.html_url})`;
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
    const app = spawn(cmd, args, { stdio: "pipe" });
    let stdout = "";
    app.stdout.on("data", (data) => {
      stdout = data;
    });
    app.on("close", (code) => {
      if (code !== 0 && !stdout.includes("nothing to commit")) {
        const err = new Error(`Invalid status code: ${code}`);
        (err as any).code = code;
        return reject(err);
      }
      return resolve(code);
    });
    app.on("error", reject);
  });

/**
 * Make a commit 提交代码
 *
 * @returns {Promise<void>}
 */
const commitFile = async () => {
  await exec("git", ["config", "--global", "user.email", COMMIT_EMAIL]);
  await exec("git", ["config", "--global", "user.name", COMMIT_NAME]);
  await exec("git", ["add", TARGET_FILE]);
  await exec("git", ["commit", "-m", COMMIT_MSG]);
  // TODO:
  // await exec("git", ["push"]);
};

const serializers = {
  IssueCommentEvent: (item: any) => {
    core.info("IssueCommentEvent");
    core.info(item);
    return `🗣 Commented on ${toUrlFormat(item)} in ${toUrlFormat(
      item.repo.name
    )}`;
  },
  IssuesEvent: (item: any) => {
    core.info("IssuesEvent");
    core.info(item);
    const emoji = item.payload.action === "opened" ? "❗" : "🔒";
    return `${emoji} ${capitalize(item.payload.action)} issue ${toUrlFormat(
      item
    )} in ${toUrlFormat(item.repo.name)}`;
  },
  PullRequestEvent: (item: any) => {
    core.info("PullRequestEvent");
    core.info(item);
    const emoji = item.payload.action === "opened" ? "💪" : "❌";
    const line = item.payload.pull_request.merged
      ? "🎉 Merged"
      : `${emoji} ${capitalize(item.payload.action)}`;
    return `${line} PR ${toUrlFormat(item)} in ${toUrlFormat(item.repo.name)}`;
  },
  ReleaseEvent: (item: any) => {
    core.info("ReleaseEvent");
    core.info(item);
    return `🚀 ${capitalize(item.payload.action)} release ${toUrlFormat(
      item
    )} in ${toUrlFormat(item.repo.name)}`;
  },
};

Toolkit.run(
  async (tools) => {
    const users = GH_USERNAMES.split(",");
    // 最好的处理方式是矩阵 martrix
    tools.log.debug(`共有 ${users.length} 个用户活动需要监听，分别是 ${users}`);

    const getActivitiesByUserName = async (username: string) => {
      // Get the user's public events
      tools.log.debug(`Getting activity for ${GH_USERNAMES}`);
      const events = await tools.github.activity.listPublicEventsForUser({
        username: GH_USERNAMES,
        per_page: 100,
      });
      tools.log.debug(
        `Activity for ${GH_USERNAMES}, ${events.data.length} events found.`
      );

      const content = events.data
        // Filter out any boring activity
        .filter((event: any) => serializers.hasOwnProperty(event.type))
        // We only have five lines to work with
        .slice(0, MAX_LINES)
        // Call the serializer to construct a string
        .map((item: any) => (serializers as any)[item.type](item));

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

      if (!content.length) {
        tools.exit.success(
          "No PullRequest/Issue/IssueComment/Release events found. Leaving README unchanged with previous activity"
        );
      }

      if (content.length < 5) {
        tools.log.info("Found less than 5 activities");
      }

      if (startIdx !== -1 && endIdx === -1) {
        // Add one since the content needs to be inserted just after the initial comment
        startIdx++;
        content.forEach((line: string, idx: number) =>
          readmeContent.splice(startIdx + idx, 0, `${idx + 1}. ${line}`)
        );

        // Append <!--END_SECTION:activity--> comment
        readmeContent.splice(
          startIdx + content.length,
          0,
          "<!--END_SECTION:activity-->"
        );

        // Update README
        fs.writeFileSync(`./${TARGET_FILE}`, readmeContent.join("\n"));

        core.info(readmeContent.join("\n"));

        // TODO:
        // Commit to the remote repository
        // try {
        //   await commitFile();
        // } catch (err) {
        //   tools.log.debug("Something went wrong");
        //   return tools.exit.failure(err);
        // }
        // tools.exit.success("Wrote to README");
      }

      const oldContent = readmeContent.slice(startIdx + 1, endIdx).join("\n");
      const newContent = content
        .map((line: string, idx: number) => `${idx + 1}. ${line}`)
        .join("\n");

      if (oldContent.trim() === newContent.trim())
        tools.exit.success("No changes detected");

      startIdx++;

      // Recent GitHub Activity content between the comments
      const readmeActivitySection = readmeContent.slice(startIdx, endIdx);
      if (!readmeActivitySection.length) {
        content.some((line: string, idx: number) => {
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

      // Commit to the remote repository
      try {
        await commitFile();
      } catch (err: any) {
        tools.log.debug("Something went wrong");
        return tools.exit.failure(err);
      }
      tools.exit.success("Pushed to remote repository");
    };

    for (const username of users) {
      await getActivitiesByUserName(username);
    }
  },
  {
    event: ["schedule", "workflow_dispatch", "push"],
    secrets: ["GITHUB_TOKEN"],
  }
);
