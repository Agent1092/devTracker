"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotContentProvider = void 0;
exports.registerSnapshotProvider = registerSnapshotProvider;
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("./apiClient");
class SnapshotContentProvider {
    async provideTextDocumentContent(uri) {
        const snapshotId = Number(uri.path.replace("/", ""));
        if (Number.isNaN(snapshotId))
            return "Invalid snapshot id";
        try {
            const snap = await (0, apiClient_1.getSnapshot)(snapshotId);
            return snap.full_text;
        }
        catch (err) {
            vscode.window.showErrorMessage(`DevTracker: failed to load snapshot ${snapshotId}: ${err?.message ?? err}`);
            return "Unable to load snapshot content.";
        }
    }
}
exports.SnapshotContentProvider = SnapshotContentProvider;
function registerSnapshotProvider(context) {
    const provider = new SnapshotContentProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("devtracker-snapshot", provider));
}
//# sourceMappingURL=snapshotProvider.js.map