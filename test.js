import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ---- テスト対象の関数（index.htmlから抽出） ----

function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += line[i];
        }
    }
    fields.push(current.trim());
    return fields;
}

function parseWordData(data) {
    return data.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
            const parts = parseCSVLine(line);
            return {
                english: parts[0] || '',
                japanese: parts[1] || '',
                tips: parts[2] || ''
            };
        });
}

// ---- index.html から WORD_DATA を取得 ----

const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/const WORD_DATA = `([\s\S]*?)`\.trim\(\);/);
assert.ok(match, 'index.html から WORD_DATA を抽出できること');
const WORD_DATA = match[1].trim();

// ---- テスト ----

describe('parseCSVLine', () => {
    test('クォートなし・3フィールドを正しく分割する', () => {
        const result = parseCSVLine('go back,戻る (90%),「あちら側へ(go)」「後ろへ(back)」離れる動き。');
        assert.equal(result.length, 3);
        assert.equal(result[0], 'go back');
        assert.equal(result[1], '戻る (90%)');
        assert.equal(result[2], '「あちら側へ(go)」「後ろへ(back)」離れる動き。');
    });

    test('クォートあり・日本語訳にカンマが含まれる場合を正しく処理する', () => {
        const result = parseCSVLine('go on,"起こる (65%)、進む (13%)",「進行・接触」のon。');
        assert.equal(result.length, 3);
        assert.equal(result[0], 'go on');
        assert.equal(result[1], '起こる (65%)、進む (13%)');
        assert.equal(result[2], '「進行・接触」のon。');
    });

    test('スペースを含むフィールドをトリムする', () => {
        const result = parseCSVLine(' find out , 発見する , TIPSテキスト ');
        assert.equal(result[0], 'find out');
        assert.equal(result[1], '発見する');
        assert.equal(result[2], 'TIPSテキスト');
    });

    test('フィールドが2つの場合も正しく分割する', () => {
        const result = parseCSVLine('word,意味');
        assert.equal(result.length, 2);
        assert.equal(result[0], 'word');
        assert.equal(result[1], '意味');
    });

    test('連続するカンマ（空フィールド）を空文字として扱う', () => {
        const result = parseCSVLine('word,,');
        assert.equal(result[0], 'word');
        assert.equal(result[1], '');
        assert.equal(result[2], '');
    });
});

describe('parseWordData', () => {
    test('空行・前後の空白を無視する', () => {
        const data = `
go back,戻る (90%),TIPSテキスト

find out,発見する,TIPSテキスト2
        `;
        const result = parseWordData(data);
        assert.equal(result.length, 2);
    });

    test('各エントリが english / japanese / tips を持つ', () => {
        const data = 'go on,"起こる、進む",TIPSテキスト';
        const result = parseWordData(data);
        assert.equal(result[0].english, 'go on');
        assert.equal(result[0].japanese, '起こる、進む');
        assert.equal(result[0].tips, 'TIPSテキスト');
    });

    test('tipsがない行は空文字になる', () => {
        const data = 'go on,起こる';
        const result = parseWordData(data);
        assert.equal(result[0].tips, '');
    });
});

describe('WORD_DATA（実データ）', () => {
    const words = parseWordData(WORD_DATA);

    test('150件の句動詞が含まれる', () => {
        assert.equal(words.length, 150);
    });

    test('全件に english フィールドが存在する', () => {
        const missing = words.filter(w => !w.english);
        assert.equal(missing.length, 0, `englishが空の件数: ${missing.length}`);
    });

    test('全件に japanese フィールドが存在する', () => {
        const missing = words.filter(w => !w.japanese);
        assert.equal(missing.length, 0, `japaneseが空の件数: ${missing.length}`);
    });

    test('全件に tips フィールドが存在する', () => {
        const missing = words.filter(w => !w.tips);
        assert.equal(missing.length, 0, `tipsが空の件数: ${missing.length}`);
    });

    test('1件目は go on', () => {
        assert.equal(words[0].english, 'go on');
        assert.equal(words[0].japanese, '起こる (65%)、進む (13%)');
    });

    test('最終件は set about', () => {
        assert.equal(words[words.length - 1].english, 'set about');
    });

    test('english フィールドにクォートが残らない', () => {
        const withQuotes = words.filter(w => w.english.includes('"'));
        assert.equal(withQuotes.length, 0);
    });

    test('japanese フィールドにクォートが残らない', () => {
        const withQuotes = words.filter(w => w.japanese.includes('"'));
        assert.equal(withQuotes.length, 0);
    });

    test('カンマ含む日本語訳が正しくパースされる（come up）', () => {
        const comeUp = words.find(w => w.english === 'come up');
        assert.ok(comeUp, 'come up が存在する');
        assert.equal(comeUp.japanese, '提案する (34%)、まもなく起こる (28%)');
    });

    test('english に半角スペースが含まれる句動詞を正しく扱う', () => {
        const multiWord = words.filter(w => w.english.includes(' '));
        assert.ok(multiWord.length > 0, '複数単語の句動詞が存在する');
    });
});
