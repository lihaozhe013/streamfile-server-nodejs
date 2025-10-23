export const testMarkdownContent = `# Welcome to Markdown Viewer

This is a **test document** with various markdown features to help with development.

## Table of Contents

- [Basic Formatting](#basic-formatting)
- [Code Examples](#code-examples)
- [Lists and Tables](#lists-and-tables)
- [Math Equations](#math-equations)

## Basic Formatting

Here's some *italic text* and **bold text**. You can also use ~~strikethrough~~.

> This is a blockquote with some interesting content.
> It can span multiple lines.

### Links and Images

- [External Link](https://github.com)
- [Internal Link](#basic-formatting)

## Code Examples

Here's an inline code example: \`const greeting = "Hello, World!";\`

### JavaScript Code Block

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
\`\`\`

### Python Code Block

\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

print(quicksort([3, 6, 8, 10, 1, 2, 1]))
\`\`\`

## Lists and Tables

### Unordered List

- First item
- Second item
  - Nested item 1
  - Nested item 2
- Third item

### Ordered List

1. First step
2. Second step
3. Third step
   1. Sub-step A
   2. Sub-step B

### Task List

- [x] Completed task
- [ ] Pending task
- [ ] Another pending task

### Table Example

| Feature | Status | Priority |
|---------|--------|----------|
| React 19 | ✅ Done | High |
| Vite 7 | ✅ Done | High |
| Path Aliases | ✅ Done | Medium |
| TypeScript | ✅ Done | High |

## Math Equations

### Inline Math

The Pythagorean theorem is $a^2 + b^2 = c^2$.

The quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$

### Block Math

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

$$
\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}
$$

Maxwell's Equations:

$$
\\begin{align}
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\epsilon_0} \\\\
\\nabla \\cdot \\mathbf{B} &= 0 \\\\
\\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t} \\\\
\\nabla \\times \\mathbf{B} &= \\mu_0\\mathbf{J} + \\mu_0\\epsilon_0\\frac{\\partial \\mathbf{E}}{\\partial t}
\\end{align}
$$

## HTML Support

<div style="background: linear-gradient(to right, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; color: white;">
  <h4 style="margin: 0;">Custom HTML Block</h4>
  <p style="margin: 10px 0 0 0;">You can embed custom HTML in markdown!</p>
</div>

<br/>

## Horizontal Rule

---

## Nested Headings

### Level 3 Heading
#### Level 4 Heading
##### Level 5 Heading
###### Level 6 Heading

---

## Footer

This is the end of the test document. Happy coding! 🚀
`;

export const shortMarkdownContent = `# Quick Test

Just a **short** test document for quick checks.

- Item 1
- Item 2
- Item 3
`;
