"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
const FILE_PATH = path_1.default.join(DATA_DIR, 'bug-reports.json');
const MAX_DESCRIPTION_LENGTH = 5000;
async function readReports() {
    try {
        const content = await promises_1.default.readFile(FILE_PATH, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
}
async function writeReports(reports) {
    await promises_1.default.mkdir(DATA_DIR, { recursive: true });
    await promises_1.default.writeFile(FILE_PATH, JSON.stringify(reports, null, 2), 'utf-8');
}
async function POST(request) {
    try {
        const body = await request.json();
        if (!body.description ||
            typeof body.description !== 'string' ||
            body.description.trim().length === 0) {
            return server_1.NextResponse.json({ error: 'Description is required' }, { status: 400 });
        }
        if (body.description.length > MAX_DESCRIPTION_LENGTH) {
            return server_1.NextResponse.json({ error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less` }, { status: 400 });
        }
        const report = {
            id: crypto.randomUUID(),
            description: body.description.trim(),
            category: body.category || null,
            severity: body.severity || null,
            url: body.url || '',
            userAgent: body.userAgent || '',
            viewport: body.viewport || { width: 0, height: 0 },
            user: body.user || null,
            consoleErrors: Array.isArray(body.consoleErrors)
                ? body.consoleErrors.slice(0, 10)
                : [],
            timestamp: new Date().toISOString(),
            status: 'open',
        };
        const reports = await readReports();
        reports.push(report);
        await writeReports(reports);
        return server_1.NextResponse.json({ success: true, id: report.id }, { status: 201 });
    }
    catch (error) {
        console.error('Bug report submission failed:', error);
        return server_1.NextResponse.json({ error: 'Failed to save bug report' }, { status: 500 });
    }
}
async function GET(request) {
    try {
        const reports = await readReports();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const filtered = status
            ? reports.filter((r) => r.status === status)
            : reports;
        return server_1.NextResponse.json(filtered);
    }
    catch (error) {
        console.error('Bug report fetch failed:', error);
        return server_1.NextResponse.json({ error: 'Failed to read bug reports' }, { status: 500 });
    }
}
