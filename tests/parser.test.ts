import { describe, it, expect } from 'vitest';
import { parseHTML } from '../src/main/parser/html';

describe('parseHTML', () => {
  it('parses simple div with text', () => {
    const ir = parseHTML('<div class="p-4">Hello</div>');
    expect(ir).toHaveLength(1);
    expect(ir[0].tag).toBe('div');
    expect(ir[0].text).toBe('Hello');
    expect(ir[0].style.padding).toEqual({ t: 16, r: 16, b: 16, l: 16 });
  });

  it('nested children preserved', () => {
    const ir = parseHTML('<div><h1>A</h1><p>B</p></div>');
    expect(ir[0].children).toHaveLength(2);
    expect(ir[0].children[0].tag).toBe('h1');
    expect(ir[0].children[1].tag).toBe('p');
    expect(ir[0].children[0].text).toBe('A');
  });

  it('skips script/style tags', () => {
    const ir = parseHTML('<div>x<script>evil()</script><style>.a{}</style></div>');
    expect(ir[0].children.filter(c => c.tag !== '#text')).toHaveLength(0);
  });

  it('img with src + alt', () => {
    const ir = parseHTML('<img src="x.png" alt="hi" />');
    expect(ir[0].tag).toBe('img');
    expect(ir[0].attrs.src).toBe('x.png');
    expect(ir[0].attrs.alt).toBe('hi');
  });

  it('inline style parsed', () => {
    const ir = parseHTML('<div style="background:#fff;padding:8px"></div>');
    expect(ir[0].style.bg).toBe('#FFF');
    expect(ir[0].style.padding).toEqual({ t: 8, r: 8, b: 8, l: 8 });
  });
});
