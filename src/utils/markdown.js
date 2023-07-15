/**
 * 返回 markdown 形式的链接
 * Returns a URL in markdown format for PR's and issues
 * @param {Object | String} item - holds information concerning the issue/PR
 *
 * @returns {String}
 */
const toUrlFormat = (item) => {
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

module.exports = {
  toUrlFormat,
};
