// ABOUT: Unit tests for HTML sanitization function
// ABOUT: Validates XSS prevention and safe HTML rendering

import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '@/sanitize';

describe('sanitizeHTML', () => {
  describe('script tag removal', () => {
    it('removes script tags completely', () => {
      const input = '<p>Safe content</p><script>alert("XSS")</script><p>More safe content</p>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<script');
      expect(output).not.toContain('alert("XSS")');
      expect(output).toContain('<p>Safe content</p>');
    });

    it('removes script tags with attributes', () => {
      const input = '<script type="text/javascript" src="evil.js">alert(1)</script>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<script');
      expect(output).not.toContain('alert(1)');
    });
  });

  describe('dangerous tag removal', () => {
    it('removes iframe tags', () => {
      const input = '<iframe src="https://evil.com"></iframe>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<iframe');
      expect(output).not.toContain('evil.com');
    });

    it('removes object tags', () => {
      const input = '<object data="evil.swf"></object>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<object');
    });

    it('removes embed tags', () => {
      const input = '<embed src="evil.swf">';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<embed');
    });

    it('removes applet tags', () => {
      const input = '<applet code="EvilApplet.class"></applet>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<applet');
    });

    it('removes base tags', () => {
      const input = '<base href="https://evil.com">';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<base');
    });

    it('removes link tags', () => {
      const input = '<link rel="stylesheet" href="evil.css">';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<link');
    });

    it('removes meta tags', () => {
      const input = '<meta http-equiv="refresh" content="0;url=https://evil.com">';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<meta');
    });

    it('removes form tags', () => {
      const input = '<form action="https://evil.com"><input type="submit"></form>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<form');
    });
  });

  describe('dangerous protocol removal', () => {
    it('removes javascript: protocol', () => {
      const input = '<a href="javascript:alert(1)">Click me</a>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('javascript:');
      expect(output).toContain('<a href="');
    });

    it('removes javascript: protocol with case variation', () => {
      const input = '<a href="JaVaScRiPt:alert(1)">Click me</a>';
      const output = sanitizeHTML(input);

      expect(output).not.toMatch(/javascript:/i);
    });

    it('removes data: protocol', () => {
      const input = '<a href="data:text/html,<script>alert(1)</script>">Click me</a>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('data:');
    });

    it('removes vbscript: protocol', () => {
      const input = '<a href="vbscript:alert(1)">Click me</a>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('vbscript:');
    });

    it('removes file: protocol', () => {
      const input = '<a href="file:///etc/passwd">Click me</a>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('file:');
    });

    it('removes about: protocol', () => {
      const input = '<a href="about:blank">Click me</a>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('about:');
    });
  });

  describe('event handler removal', () => {
    it('removes onclick handlers with quotes', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('onclick');
      expect(output).not.toContain('alert(1)');
    });

    it('removes onclick handlers without quotes', () => {
      const input = '<div onclick=alert(1)>Click me</div>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('onclick');
    });

    it('removes onclick handlers with unusual spacing', () => {
      const input = '<div onclick  =  "alert(1)">Click me</div>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('onclick');
      expect(output).not.toContain('alert(1)');
    });

    it('removes onerror handlers', () => {
      const input = '<img src="x" onerror="alert(1)">';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('onerror');
      expect(output).not.toContain('alert(1)');
    });

    it('removes onerror handlers without quotes', () => {
      const input = '<img src="x" onerror=alert(1)>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('onerror=');
    });

    it('removes onload handlers', () => {
      const input = '<body onload="alert(1)">Content</body>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('onload');
    });

    it('removes multiple different event handlers', () => {
      const input = '<div onclick="alert(1)" onmouseover="alert(2)" onfocus="alert(3)">Test</div>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('onclick');
      expect(output).not.toContain('onmouseover');
      expect(output).not.toContain('onfocus');
    });
  });

  describe('style attribute removal', () => {
    it('removes style attributes from non-img elements', () => {
      const input = '<div style="background: url(javascript:alert(1))">Test</div>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('style=');
    });

    it('removes style attributes with expressions', () => {
      const input = '<p style="color: expression(alert(1))">Test</p>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('style=');
      expect(output).not.toContain('expression');
    });

    it('preserves style on img tags', () => {
      const input = '<img src="/test.jpg" style="width: 100px; height: 100px;">';
      const output = sanitizeHTML(input);

      expect(output).toContain('style="width: 100px; height: 100px;"');
      expect(output).toContain('<img');
    });
  });

  describe('img tag preservation', () => {
    it('preserves safe img tags', () => {
      const input = '<img src="/test.jpg" alt="Test image">';
      const output = sanitizeHTML(input);

      expect(output).toContain('<img');
      expect(output).toContain('src="/test.jpg"');
      expect(output).toContain('alt="Test image"');
    });

    it('preserves width and height on img tags', () => {
      const input = '<img src="/test.jpg" width="100" height="100">';
      const output = sanitizeHTML(input);

      expect(output).toContain('width="100"');
      expect(output).toContain('height="100"');
    });

    it('removes event handlers from img tags but preserves other attributes', () => {
      const input = '<img src="/test.jpg" onerror="alert(1)" width="100">';
      const output = sanitizeHTML(input);

      expect(output).toContain('src="/test.jpg"');
      expect(output).toContain('width="100"');
      expect(output).not.toContain('onerror');
    });
  });

  describe('safe content preservation', () => {
    it('preserves safe HTML', () => {
      const input = '<p>This is <strong>safe</strong> content with <a href="https://example.com">a link</a></p>';
      const output = sanitizeHTML(input);

      expect(output).toContain('<p>');
      expect(output).toContain('<strong>');
      expect(output).toContain('<a href="https://example.com">');
    });

    it('preserves headings', () => {
      const input = '<h1>Title</h1><h2>Subtitle</h2>';
      const output = sanitizeHTML(input);

      expect(output).toContain('<h1>Title</h1>');
      expect(output).toContain('<h2>Subtitle</h2>');
    });

    it('preserves lists', () => {
      const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const output = sanitizeHTML(input);

      expect(output).toContain('<ul>');
      expect(output).toContain('<li>Item 1</li>');
    });

    it('preserves code blocks', () => {
      const input = '<pre><code>const x = 1;</code></pre>';
      const output = sanitizeHTML(input);

      expect(output).toContain('<pre>');
      expect(output).toContain('<code>');
      expect(output).toContain('const x = 1;');
    });
  });

  describe('complex attack scenarios', () => {
    it('handles mixed dangerous and safe content', () => {
      const input = `
        <p>Safe paragraph</p>
        <script>alert("XSS")</script>
        <p>Another safe paragraph</p>
        <iframe src="evil.com"></iframe>
        <p>More safe content</p>
      `;
      const output = sanitizeHTML(input);

      expect(output).toContain('<p>Safe paragraph</p>');
      expect(output).toContain('<p>Another safe paragraph</p>');
      expect(output).toContain('<p>More safe content</p>');
      expect(output).not.toContain('<script');
      expect(output).not.toContain('<iframe');
    });

    it('handles nested dangerous tags', () => {
      const input = '<div><script><iframe src="evil"></iframe></script></div>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('<script');
      expect(output).not.toContain('<iframe');
      expect(output).toContain('<div>');
    });

    it('handles multiple attack vectors in single element', () => {
      const input = '<a href="javascript:alert(1)" onclick="alert(2)" style="background: url(javascript:alert(3))">Click</a>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('javascript:');
      expect(output).not.toContain('onclick');
      expect(output).not.toContain('style=');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const output = sanitizeHTML('');
      expect(output).toBe('');
    });

    it('handles plain text without HTML', () => {
      const input = 'Just plain text with no HTML';
      const output = sanitizeHTML(input);

      expect(output).toBe(input);
    });

    it('handles HTML entities', () => {
      const input = '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>';
      const output = sanitizeHTML(input);

      expect(output).toContain('&lt;script&gt;');
      expect(output).toContain('&lt;/script&gt;');
    });
  });
});
