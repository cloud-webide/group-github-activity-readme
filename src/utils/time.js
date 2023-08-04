const dayjs = require("dayjs");
const { format } = require("../constant");
const formatDate = (date) => dayjs(date).format(format);

module.exports = {
  formatDate,
};
