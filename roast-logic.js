// Shared roast parsing and formatting helpers. Keep DOM-specific code in index.html.

function normalizeProfileInputs(values) {
    const targetLength = maxProfileMinute + 1;
    const normalized = Array.isArray(values) ? values.slice(0, targetLength).map((value) => value || '') : [];
    while (normalized.length < targetLength) {
        normalized.push('');
    }
    return normalized;
}

function appendUniqueSuggestion(currentValue, suggestion) {
    const value = String(currentValue || '').replace(/\s+/g, ' ').trim();
    const token = String(suggestion || '').replace(/\s+/g, ' ').trim();
    if (!token) {
        return value;
    }

    const valueLower = value.toLowerCase();
    const tokenLower = token.toLowerCase();
    if (valueLower.split(/\s+/).join(' ').includes(tokenLower)) {
        return value;
    }

    return value ? `${value} ${token}` : token;
}

function parseProfileMinuteToken(token, allowBareMinute = true) {
    const normalized = normalizeNumericText(String(token).trim());
    const timeMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
        const minutes = parseInt(timeMatch[1], 10);
        const seconds = parseInt(timeMatch[2], 10);
        return seconds === 0 ? minutes : null;
    }
    if (allowBareMinute && /^\d{1,2}$/.test(normalized)) {
        return parseInt(normalized, 10);
    }
    return null;
}

function parseProfileTemperatureToken(token) {
    const normalized = normalizeNumericText(String(token).trim());
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
        return null;
    }
    const value = parseFloat(normalized);
    return Number.isFinite(value) && value >= 0 && value <= 300 ? value : null;
}

function formatProfileTemperatureValue(value) {
    return Number.isInteger(value) ? String(value) : String(parseFloat(value.toFixed(1)));
}

function parseProfilePasteLine(line, fallbackMinute) {
    const trimmed = line.trim();
    if (trimmed === '') {
        return { skipped: true };
    }

    const tokens = trimmed.split(/[,\t; ]+/).filter(Boolean);
    const colonIndex = tokens.findIndex((token) => normalizeNumericText(token).includes(':'));
    let minute = null;
    let temp = null;

    if (colonIndex !== -1) {
        minute = parseProfileMinuteToken(tokens[colonIndex], false);
        for (let i = colonIndex + 1; i < tokens.length; i++) {
            temp = parseProfileTemperatureToken(tokens[i]);
            if (temp !== null) {
                break;
            }
        }
        if (temp === null) {
            for (let i = colonIndex - 1; i >= 0; i--) {
                temp = parseProfileTemperatureToken(tokens[i]);
                if (temp !== null) {
                    break;
                }
            }
        }
    } else {
        const numbers = tokens
            .map((token) => ({ token, value: parseProfileTemperatureToken(token) }))
            .filter((item) => item.value !== null);

        if (numbers.length === 1) {
            minute = fallbackMinute;
            temp = numbers[0].value;
        } else if (numbers.length >= 2) {
            const first = numbers[0].value;
            const second = numbers[1].value;
            if (Number.isInteger(first) && first >= 0 && first <= maxProfileMinute) {
                minute = first;
                temp = second;
            } else if (Number.isInteger(second) && second >= 0 && second <= maxProfileMinute) {
                minute = second;
                temp = first;
            } else if (Number.isInteger(first) && first % 60 === 0 && first / 60 <= maxProfileMinute) {
                minute = first / 60;
                temp = second;
            }
        }
    }

    if (minute === null && temp === null && /[a-zA-Z_]/.test(trimmed)) {
        return { skipped: true };
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > maxProfileMinute || temp === null) {
        return { invalid: true, line: trimmed };
    }

    return { minute, value: formatProfileTemperatureValue(temp), line: trimmed };
}

function parseProfilePasteText(text, startMinute = 0) {
    const values = normalizeProfileInputs(getProfileInputValues());
    const invalidRows = [];
    let appliedRows = 0;
    let sequentialMinute = startMinute;

    String(text).split(/\r?\n/).forEach((line) => {
        const parsed = parseProfilePasteLine(line, sequentialMinute);
        if (parsed.skipped) {
            return;
        }
        if (parsed.invalid) {
            invalidRows.push(parsed.line);
            sequentialMinute++;
            return;
        }
        values[parsed.minute] = parsed.value;
        appliedRows++;
        sequentialMinute = parsed.minute + 1;
    });

    return { values, invalidRows, appliedRows };
}

function normalizeCueInterval(value) {
    const interval = parseInt(value, 10);
    return interval === 15 ? 15 : 10;
}

function normalizeNumericText(value) {
    return value
        .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/[．。点]/g, '.')
        .replace(/[，、]/g, '.')
        .replace(/\s+/g, '');
}

function parseRecognizedTemperature(transcript) {
    const normalized = normalizeNumericText(transcript);
    const match = normalized.match(/\d+(?:\.\d+)?/);
    if (!match) {
        return null;
    }

    const token = match[0];
    const value = token.includes('.') || token.length !== 4
        ? parseFloat(token)
        : parseFloat(token) / 10;

    return Number.isFinite(value) ? { value, token } : null;
}

function roundToDataSlot(seconds) {
    return Math.max(0, Math.round(seconds / dataInterval) * dataInterval);
}

if (typeof window !== 'undefined') {
    Object.assign(window, {
        normalizeProfileInputs,
        appendUniqueSuggestion,
        parseProfileMinuteToken,
        parseProfileTemperatureToken,
        formatProfileTemperatureValue,
        parseProfilePasteLine,
        parseProfilePasteText,
        normalizeCueInterval,
        normalizeNumericText,
        parseRecognizedTemperature,
        roundToDataSlot
    });
}
