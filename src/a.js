const { commitFile } = require("./utils/commit");

async function a() {
  try {
    const COMMIT_EMAIL =
      "41898282+github-actions[bot]@users.noreply.github.com";
    const COMMIT_NAME = "github-actions[bot]";
    const TARGET_FILE = "src/a.js";
    const COMMIT_MSG = "Update a.js";
    await commitFile(COMMIT_EMAIL, COMMIT_NAME, TARGET_FILE, COMMIT_MSG);
  } catch (err) {
    console.error("Something went wrong", err);
  }
}

a();
