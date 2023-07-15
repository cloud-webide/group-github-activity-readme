const fs = require("fs");

const TARGET_FILE = "README.md";

(async (tools) => {
  const content = `## yiliang114's activities:

  ### [microsoft/vscode](https://github.com/microsoft/vscode)
  
  1. 💪 Opened PR [#187902](https://github.com/microsoft/vscode/pull/187902) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-07-14 06:11:21
  2. ❗ Opened issue [#187826](https://github.com/microsoft/vscode/issues/187826) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-07-13 12:36:02
  3. 💪 Opened PR [#187796](https://github.com/microsoft/vscode/pull/187796) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-07-13 06:25:23
  4. ❗ Opened issue [#187795](https://github.com/microsoft/vscode/issues/187795) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-07-13 06:23:44
  5. ❗ Opened issue [#187788](https://github.com/microsoft/vscode/issues/187788) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-07-13 02:47:35
  6. ❗ Opened issue [#186701](https://github.com/microsoft/vscode/issues/186701) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-06-30 08:08:20
  7. 💪 Opened PR [#186607](https://github.com/microsoft/vscode/pull/186607) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-06-29 08:53:16
  8. ❗ Opened issue [#185312](https://github.com/microsoft/vscode/issues/185312) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-06-16 08:30:41
  9. ❗ Opened issue [#183890](https://github.com/microsoft/vscode/issues/183890) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-05-31 02:45:06
  10. 💪 Opened PR [#183507](https://github.com/microsoft/vscode/pull/183507) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-05-26 08:40:55
  11. ❗ Opened issue [#183506](https://github.com/microsoft/vscode/issues/183506) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-05-26 08:40:37
  
  ### [microsoft/vscode-l10n](https://github.com/microsoft/vscode-l10n)
  
  1. 💪 Opened PR [#120](https://github.com/microsoft/vscode-l10n/pull/120) in [microsoft/vscode-l10n](https://github.com/microsoft/vscode-l10n) at 2023-07-07 10:08:56
  2. ❗ Opened issue [#119](https://github.com/microsoft/vscode-l10n/issues/119) in [microsoft/vscode-l10n](https://github.com/microsoft/vscode-l10n) at 2023-07-07 09:33:51
  3. 💪 Opened PR [#118](https://github.com/microsoft/vscode-l10n/pull/118) in [microsoft/vscode-l10n](https://github.com/microsoft/vscode-l10n) at 2023-06-30 07:22:05
  
  ### [microsoft/vscode-test-web](https://github.com/microsoft/vscode-test-web)
  
  1. 💪 Opened PR [#86](https://github.com/microsoft/vscode-test-web/pull/86) in [microsoft/vscode-test-web](https://github.com/microsoft/vscode-test-web) at 2023-06-27 08:48:30
  
  ## harbin1053020115's activities:
  
  ### [microsoft/vscode](https://github.com/microsoft/vscode)
  
  1. 💪 Opened PR [#182950](https://github.com/microsoft/vscode/pull/182950) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-05-19 08:08:25
  2. ❗ Opened issue [#182949](https://github.com/microsoft/vscode/issues/182949) in [microsoft/vscode](https://github.com/microsoft/vscode) at 2023-05-19 08:03:13`.split(
    "\n"
  );
  const readmeContent = fs.readFileSync(`./README.md`, "utf-8").split("\n");

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
  let endIdx = readmeContent.findIndex(
    (content) => content.trim() === "<!--END_SECTION:activity-->"
  );

  console.log(`startIdx: ${startIdx}, endIdx: ${endIdx}`);

  if (startIdx !== -1 && endIdx === -1) {
    // Add one since the content needs to be inserted just after the initial comment
    startIdx++;
    content.forEach(
      (line, idx) => readmeContent.splice(startIdx + idx, 0, line) // 格式在前面处理
    );

    // Append <!--END_SECTION:activity--> comment
    readmeContent.splice(
      startIdx + content.length,
      0,
      "<!--END_SECTION:activity-->"
    );

    // Update README
    fs.writeFileSync(`./README.md`, readmeContent.join("\n"));

    console.log(`writeFileSync: ${readmeContent.length}`);
  }

  const oldContent = readmeContent.slice(startIdx + 1, endIdx).join("\n");
  const newContent = content.join("\n");

  if (oldContent.trim() === newContent.trim()) {
    console.log("No changes detected");
  }

  startIdx++;

  // Recent GitHub Activity content between the comments
  const readmeActivitySection = readmeContent.slice(startIdx, endIdx);
  if (readmeActivitySection.length) {
    // 清除旧数据
    readmeContent.splice(startIdx, startIdx + readmeActivitySection.length);
    endIdx = readmeContent.findIndex(
      (content) => content.trim() === "<!--END_SECTION:activity-->"
    );
  }

  content.forEach((line, idx) => {
    readmeContent.splice(startIdx + idx, 0, line);
  });
  console.log(`Wrote to ${TARGET_FILE}`);

  // Update README
  fs.writeFileSync(`./${TARGET_FILE}`, readmeContent.join("\n"));
  console.log(`writeFileSync: ${readmeContent.length}`);
  console.log(`${readmeContent.join("\n")}`);
})();
