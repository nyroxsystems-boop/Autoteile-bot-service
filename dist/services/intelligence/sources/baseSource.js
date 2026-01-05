"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampConfidence = clampConfidence;
exports.logSourceResult = logSourceResult;
function clampConfidence(v) {
    if (isNaN(v))
        return 0;
    return Math.max(0, Math.min(1, v));
}
function logSourceResult(_name, _count) {
    // noop placeholder for logging helper used in sources
}
