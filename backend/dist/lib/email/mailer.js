"use strict";
/**
 * Email sending service
 *
 * Supports two modes:
 * 1. Resend HTTP API (recommended for VPS — no SMTP ports needed)
 *    Set RESEND_API_KEY in .env.local
 * 2. Fallback: Supabase Mailpit (local catch-all, viewable at /mail/)
 */
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
exports.sendEmail = sendEmail;
async function sendEmail(options) {
    const resendKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
    if (resendKey && resendKey.startsWith('re_')) {
        // Use Resend HTTP API (works even when SMTP ports are blocked)
        return sendViaResend(resendKey, options);
    }
    // Fallback: Supabase Mailpit (local email testing)
    return sendViaMailpit(options);
}
async function sendViaResend(apiKey, options) {
    try {
        const from = process.env.SMTP_FROM || 'Worklo <onboarding@resend.dev>';
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: [options.to],
                subject: options.subject,
                html: options.html,
                text: options.text,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('Resend API error:', data);
            return { success: false, error: data.message || `HTTP ${res.status}` };
        }
        console.warn(`📧 Email sent to ${options.to} via Resend: ${data.id}`);
        return { success: true, messageId: data.id };
    }
    catch (error) {
        console.error('Failed to send email via Resend:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
async function sendViaMailpit(options) {
    try {
        // Dynamic import to avoid bundling nodemailer when using Resend
        const nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer')));
        const transporter = nodemailer.default.createTransport({
            host: '127.0.0.1',
            port: 54325,
            secure: false,
            tls: { rejectUnauthorized: false },
        });
        const from = process.env.SMTP_FROM || 'Worklo <noreply@Worklo.local>';
        const info = await transporter.sendMail({
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
        console.warn(`📧 Email sent to ${options.to} via Mailpit: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    }
    catch (error) {
        console.error('Failed to send email via Mailpit:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
