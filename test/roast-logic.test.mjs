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
        rorDisplay: { innerText: '' },
        maxProfileMinute: 15,
        getProfileInputValues: () => Array(16).fill(''),
        navigator: {
            userAgent: '',
            platform: '',
            maxTouchPoints: 0
        }
    };

    vm.createContext(context);
    [
        'normalizeProfileInputs',
        'normalizeNumericText',
        'parseProfileMinuteToken',
        'parseProfileTemperatureToken',
        'formatProfileTemperatureValue',
        'parseProfilePasteLine',
        'parseProfilePasteText',
        'isIOSDevice',
        'getSafariMajorVersion',
        'supportsSwitchHapticCue',
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

test('parseProfilePasteText accepts temp-time, time-temp, minute-temp, and CSV export rows', () => {
    const logic = createLogicContext();
    const pasted = [
        'temp,time',
        '150 00:00',
        '01:00,80',
        '2,105',
        '180,03:00,128.0,132.0',
        '999,99:00',
        'bad row'
    ].join('\n');

    const result = toPlainObject(logic.parseProfilePasteText(pasted, 0));

    assert.equal(result.appliedRows, 4);
    assert.deepEqual(result.invalidRows, ['999,99:00']);
    assert.equal(result.values[0], '150');
    assert.equal(result.values[1], '80');
    assert.equal(result.values[2], '105');
    assert.equal(result.values[3], '128');
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

test('supportsSwitchHapticCue detects iPhone and touch iPad user agents', () => {
    const logic = createLogicContext();

    logic.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
    assert.equal(logic.supportsSwitchHapticCue(), true);

    logic.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Version/17.6 Mobile/15E148 Safari/604.1';
    assert.equal(logic.supportsSwitchHapticCue(), false);

    logic.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
    logic.navigator.platform = 'MacIntel';
    logic.navigator.maxTouchPoints = 5;
    assert.equal(logic.supportsSwitchHapticCue(), true);

    logic.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
    logic.navigator.platform = 'MacIntel';
    logic.navigator.maxTouchPoints = 0;
    assert.equal(logic.supportsSwitchHapticCue(), false);
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
