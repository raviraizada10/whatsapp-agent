/**
 * Central registry for Agent Tools
 */
class ToolRegistry {
    constructor() {
        this.tools = {};
    }

    /**
     * Register a new tool
     * @param {string} name Unique name of the tool
     * @param {string} description Detailed description for the LLM
     * @param {object} parameters JSON Schema for parameters
     * @param {function} execute The async function to run
     */
    register(name, description, parameters, execute) {
        this.tools[name] = {
            name,
            description,
            parameters,
            execute
        };
    }

    /**
     * Get all registered tool definitions for the system prompt
     */
    getToolDefinitions() {
        return Object.values(this.tools).map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }));
    }

    /**
     * Format tool definitions as a string for the AI prompt
     */
    formatToolsForPrompt() {
        let prompt = "AVAILABLE TOOLS:\n";
        for (const name in this.tools) {
            const t = this.tools[name];
            prompt += `- ${t.name}: ${t.description}\n`;
            prompt += `  Parameters: ${JSON.stringify(t.parameters)}\n`;
        }
        return prompt;
    }

    /**
     * Call a tool by name with arguments
     */
    async call(name, args) {
        if (!this.tools[name]) {
            throw new Error(`Tool "${name}" not found.`);
        }
        console.log(`🛠️ Executing Tool: ${name} with args:`, args);
        try {
            return await this.tools[name].execute(args);
        } catch (error) {
            console.error(`❌ Error executing tool "${name}":`, error.message);
            return `Error: ${error.message}`;
        }
    }
}

const registry = new ToolRegistry();

// Export the singleton registry
module.exports = registry;
