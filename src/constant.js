const dayjs = require("dayjs");

// 时间格式
const format = "YYYY-MM-DD HH:mm:ss";

const formatDate = (date) => dayjs(date).format(format);

module.exports = {
  format,
  formatDate,
};
