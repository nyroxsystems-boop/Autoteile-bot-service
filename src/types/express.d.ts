// Express type extensions for custom properties
// Extends Request interface to include tenant information

declare global {
    namespace Express {
        interface Request {
            tenantId?: string;
            userId?: string;
        }
    }
}

export { };
