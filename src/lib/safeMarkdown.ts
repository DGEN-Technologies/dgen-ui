import { marked } from "marked";
import DOMPurify from "dompurify";
import { browser } from "$app/environment";

marked.setOptions({
    breaks: false,
    gfm: true,     // GitHub-style markdown
});

// Convert markdown to sanitized HTML.
export async function renderSafeMarkdown(markdown: string): Promise<string> {
    if (!browser) return markdown;

    const rawHtml = await marked.parse(markdown); // safe future-proof
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true },
    });

    return cleanHtml;
}
