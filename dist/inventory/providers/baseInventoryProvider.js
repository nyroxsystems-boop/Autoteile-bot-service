"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BaseInventoryProvider {
    constructor(connection) {
        this.id = connection.id;
        this.name = connection.name;
        this.type = connection.type;
        this.baseUrl = connection.baseUrl ?? "";
        this.authConfig = connection.authConfig ?? null;
        this.config = connection.config ?? null;
    }
    // To be implemented by subclasses.
    async checkAvailabilityByOem(_oemNumber) {
        throw new Error("Not implemented");
    }
}
exports.default = BaseInventoryProvider;
