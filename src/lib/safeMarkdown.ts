import { marked } from "marked";
import DOMPurify from "dompurify";
import { browser } from "$app/environment";

let domPurifyHooksRegistered = false;

function ensureDomPurifyHooks() {
    if (!browser || domPurifyHooksRegistered) return;

    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
        if (node.nodeName !== "A") return;

        node.setAttribute("rel", "noopener noreferrer nofollow");

        if (node.hasAttribute("target")) {
            const target = node.getAttribute("target")?.toLowerCase();
            if (target === "_blank") {
                node.setAttribute("target", "_blank");
            } else {
                node.removeAttribute("target");
            }
        }
    });

    domPurifyHooksRegistered = true;
}

marked.setOptions({
    breaks: false,
    gfm: true, // GitHub-style markdown
});

// Convert markdown to sanitized HTML, enforcing tight link hygiene for the assistant output.
export async function renderSafeMarkdown(markdown: string): Promise<string> {
    // SSR safety: never return unsanitized markdown/HTML
    if (!browser) return "";

    ensureDomPurifyHooks();

    const rawHtml = await marked.parse(markdown); // safe future-proof
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: ["p", "br", "strong", "em", "a", "ul", "ol", "li", "code", "pre"],
        ALLOWED_ATTR: ["href", "target", "rel"],
        ALLOWED_URI_REGEXP: /^(https?:)?\/\//i,
    });

    return cleanHtml;
}
