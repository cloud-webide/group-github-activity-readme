const { spawn } = require("child_process");

/**
 * Execute shell command
 * @param {String} cmd - root command
 * @param {String[]} args - args to be passed along with
 *
 * @returns {Promise<void>}
 */
const exec = (cmd, args = []) =>
  new Promise((resolve, reject) => {
    const app = spawn(cmd, args, { stdio: "pipe" });
    let stdout = "";
    app.stdout.on("data", (data) => {
      stdout = data;
    });
    app.on("close", (code) => {
      if (code !== 0 && !stdout.includes("nothing to commit")) {
        err = new Error(`Invalid status code: ${code}`);
        err.code = code;
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
const commitFile = async (
  COMMIT_EMAIL,
  COMMIT_NAME,
  TARGET_FILE,
  COMMIT_MSG
) => {
  await exec("git", ["config", "--global", "user.email", COMMIT_EMAIL]);
  await exec("git", ["config", "--global", "user.name", COMMIT_NAME]);
  // await exec("git", ["add", TARGET_FILE]);
  await exec("git", ["add", "."]);
  await exec("git", ["commit", "-m", COMMIT_MSG]);
  await exec("git", ["push"]);
};

module.exports = {
  commitFile,
};
