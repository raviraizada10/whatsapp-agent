const registry = require('../toolRegistry');
const webSearch = require('./webSearch');
const trainStatus = require('./trainStatus');
const calendarTool = require('./calendarTool');

// Register all tools
registry.register(webSearch.name, webSearch.description, webSearch.parameters, webSearch.execute);
registry.register(trainStatus.name, trainStatus.description, trainStatus.parameters, trainStatus.execute);
registry.register(calendarTool.name, calendarTool.description, calendarTool.parameters, calendarTool.execute);

module.exports = registry;
