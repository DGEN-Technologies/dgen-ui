## Description
<!-- Describe your changes -->

## Security Checklist
<!-- Check all that apply -->

### Changes to Sensitive Code
- [ ] This PR modifies `src/lib/secureStorage.ts`
- [ ] This PR modifies `src/lib/walletService.ts`
- [ ] This PR modifies seed phrase display components
- [ ] This PR modifies authentication/authorization logic
- [ ] This PR adds new dependencies

### Security Review
- [ ] No new uses of `innerHTML`, `dangerouslySetInnerHTML`, or `{@html}`
- [ ] All user inputs are properly sanitized
- [ ] No sensitive data logged to console
- [ ] No secrets committed to repository
- [ ] CSP remains strict (no relaxation of policies)
- [ ] HTTPS enforced for all external connections
- [ ] Dependencies scanned for vulnerabilities
- [ ] Changes reviewed by security-aware team member

### Testing
- [ ] Unit tests added/updated
- [ ] Security tests added (if applicable)
- [ ] Tested in production-like environment
- [ ] No console errors or warnings

## Reviewer Notes
<!-- Additional context for reviewers -->
