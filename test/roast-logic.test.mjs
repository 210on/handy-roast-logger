import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extractFunctionSource(name) {
    const start = html.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Could not find function ${name}`);

    const braceStart = html.indexOf('{', start);
    let depth = 0;
    for (let i = braceStart; i < html.length; i++) {
        if (html[i] === '{') {
            depth++;
        } else if (html[i] === '}') {
            depth--;
            if (depth === 0) {
                return html.slice(start, i + 1);
            }
        }
    }

    throw new Error(`Could not parse function ${name}`);
}

function createLogicContext() {
    const context = {
        tickInterval: 10,
        rawTemps: [],
        temps: [],
        rors: [],
        referenceProfile: [],
        bottomTempIndex: null,
        rorDisplay: { innerText: '' }
    };

    vm.createContext(context);
    [
        'normalizeNumericText',
        'parseRecognizedTemperature',
        'findPreviousValidIndex',
        'detectOutlier',
        'interpolateMissingData',
        'calculateRoR',
        'findBottomTempIndex',
        'calculateDataQuality'
    ].forEach((name) => {
        vm.runInContext(extractFunctionSource(name), context);
    });

    return context;
}

function toPlainObject(value) {
    return JSON.parse(JSON.stringify(value));
}

test('parseRecognizedTemperature handles Japanese decimal speech and compact four digit values', () => {
    const logic = createLogicContext();

    assert.deepEqual(toPlainObject(logic.parseRecognizedTemperature('２１０点５')), { value: 210.5, token: '210.5' });
    assert.deepEqual(toPlainObject(logic.parseRecognizedTemperature('温度は 206 です')), { value: 206, token: '206' });
    assert.deepEqual(toPlainObject(logic.parseRecognizedTemperature('誤認識 2100')), { value: 210, token: '2100' });
    assert.equal(logic.parseRecognizedTemperature('温度わからない'), null);
});

test('detectOutlier rejects impossible values and late hard jumps', () => {
    const logic = createLogicContext();
    logic.referenceProfile = [150, 80, 105, 128, 149, 167, 182, 194, 202, 206, 209];
    logic.rawTemps[54] = 207;

    assert.equal(logic.detectOutlier(560, 2100).isOutlier, true);
    assert.equal(logic.detectOutlier(560, 2100).reason, 'outside valid temperature range');
    assert.equal(logic.detectOutlier(550, 208).isOutlier, false);
    assert.equal(logic.detectOutlier(550, 285).isOutlier, true);
});

test('interpolateMissingData fills skipped slots between captured readings', () => {
    const logic = createLogicContext();
    logic.rawTemps[0] = 160;
    logic.temps[0] = 160;
    logic.rawTemps[3] = 190;
    logic.temps[3] = 190;

    logic.interpolateMissingData(3);

    assert.equal(logic.temps[1], 170);
    assert.equal(logic.temps[2], 180);
    assert.equal(logic.temps[3], 190);
});

test('calculateRoR starts after bottom temperature has a rising captured point', () => {
    const logic = createLogicContext();
    logic.rawTemps.push(160, 91, 75, 82, 90);
    logic.temps.push(160, 91, 75, 82, 90);
    logic.rors.push(null, null, null, null, null);

    logic.calculateRoR();

    assert.equal(logic.bottomTempIndex, 2);
    assert.equal(logic.rors[2], 0);
    assert.equal(logic.rors[3], 42);
    assert.equal(logic.rors[4], 48);
    assert.equal(logic.rorDisplay.innerText, '48.0');
});

test('calculateDataQuality summarizes captured, interpolated, missed, and rejected values', () => {
    const logic = createLogicContext();
    logic.rawTemps[0] = 160;
    logic.rawTemps[1] = null;
    logic.temps[1] = 151;
    logic.rawTemps[2] = null;
    logic.temps[2] = null;
    logic.rawTemps[3] = 149;
    logic.temps[3] = 149;
    logic.dataQuality = { rejectedOutliers: 2 };

    assert.deepEqual(toPlainObject(logic.calculateDataQuality(4)), {
        capturedPoints: 2,
        interpolatedPoints: 1,
        missedSlots: 1,
        rejectedOutliers: 2
    });
});
