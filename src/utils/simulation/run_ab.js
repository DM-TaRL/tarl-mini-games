"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
var fs = require("fs");
var path = require("path");
var types_1 = require("./types");
var simulate_ab_1 = require("./simulate_ab");
var fuzzy_evaluator_1 = require("../fuzzy-evaluator");
var NUM_SESSIONS = 1000000; // set lower for local dev (e.g., 100_000)
var OUT_DIR = path.resolve(process.cwd(), "results");
function toCSV(rows) {
    var header = __spreadArray(__spreadArray([
        "id"
    ], types_1.AXIS_KEYS, true), [
        "inferredGrade",
        "confidence",
        "coverageMean",
        "mode",
    ], false).join(",");
    var lines = rows.map(function (r) {
        return __spreadArray(__spreadArray([
            r.id
        ], types_1.AXIS_KEYS.map(function (k) { return r[k].toFixed(0); }), true), [
            r.inferredGrade.toFixed(2),
            r.confidence.toFixed(3),
            r.coverageMean.toFixed(2),
            r.mode,
        ], false).join(",");
    });
    return __spreadArray([header], lines, true).join("\n");
}
function evaluateMode(useDynamic, sample, outPath) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, _loop_1, i;
        return __generator(this, function (_a) {
            rows = [];
            _loop_1 = function (i) {
                var _b = sample[i], axes = _b.axes, coverage = _b.coverage, testConfig = _b.testConfig;
                var mode = useDynamic ? "dynamic" : "static";
                var memberships = configToMembershipArray(testConfig, mode);
                var out = (0, fuzzy_evaluator_1.inferFuzzyGrade)(axes, coverage, memberships, useDynamic);
                var covMean = types_1.AXIS_KEYS.reduce(function (s, k) { var _a; return s + ((_a = coverage[k]) !== null && _a !== void 0 ? _a : 0); }, 0) / types_1.AXIS_KEYS.length;
                rows.push(__assign(__assign({ id: i + 1 }, axes), { inferredGrade: out.inferredGrade, confidence: out.confidence, coverageMean: +covMean.toFixed(2), mode: mode }));
            };
            for (i = 0; i < sample.length; i++) {
                _loop_1(i);
            }
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, toCSV(rows), "utf8");
            return [2 /*return*/, rows];
        });
    });
}
(function () { return __awaiter(void 0, void 0, void 0, function () {
    // quick summaries
    function mean(arr) {
        return arr.reduce(function (s, x) { return s + x; }, 0) / arr.length;
    }
    function variance(arr, m) {
        if (m === void 0) { m = mean(arr); }
        return arr.reduce(function (s, x) { return s + Math.pow((x - m), 2); }, 0) / (arr.length - 1);
    }
    // slope(confidence ~ coverage)
    function slopeXY(x, y) {
        var mx = mean(x), my = mean(y);
        var num = x.reduce(function (s, xi, i) { return s + (xi - mx) * (y[i] - my); }, 0);
        var den = x.reduce(function (s, xi) { return s + Math.pow((xi - mx), 2); }, 0) || 1e-9;
        return num / den;
    }
    // rank agreement on a subsample (Spearman rho; faster than Kendall for big N)
    function rank(arr) {
        var idx = arr
            .map(function (v, i) { return [v, i]; })
            .sort(function (a, b) { return a[0] - b[0]; })
            .map(function (_a) {
            var i = _a[1];
            return i;
        });
        var r = Array(arr.length);
        for (var k = 0; k < idx.length; k++)
            r[idx[k]] = k;
        return r;
    }
    function spearmanRho(a, b) {
        var n = a.length;
        var ra = rank(a), rb = rank(b);
        var d2 = 0;
        for (var i = 0; i < n; i++) {
            var d = ra[i] - rb[i];
            d2 += d * d;
        }
        return 1 - (6 * d2) / (n * (n * n - 1));
    }
    // boundary bands (±0.25 around grades 3.0–6.0)
    function bandVar(rows, g) {
        var band = rows.filter(function (r) { return Math.abs(r.inferredGrade - g) <= 0.25; });
        var arr = band.map(function (r) { return r.inferredGrade; });
        return arr.length ? variance(arr) : NaN;
    }
    var sessions, staticRows, dynamicRows, gA, gB, cA, cB, absDiff, covA, covB, S, rho;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                sessions = (0, simulate_ab_1.makeSessions)(NUM_SESSIONS, 20251020);
                return [4 /*yield*/, evaluateMode(false, //static
                    sessions, path.join(OUT_DIR, "static", "results.csv"))];
            case 1:
                staticRows = _a.sent();
                return [4 /*yield*/, evaluateMode(true, // dynamic
                    sessions, path.join(OUT_DIR, "dynamic", "results.csv"))];
            case 2:
                dynamicRows = _a.sent();
                gA = staticRows.map(function (r) { return r.inferredGrade; });
                gB = dynamicRows.map(function (r) { return r.inferredGrade; });
                cA = staticRows.map(function (r) { return r.confidence; });
                cB = dynamicRows.map(function (r) { return r.confidence; });
                absDiff = gA.map(function (g, i) { return Math.abs(gB[i] - g); });
                console.log("mean |Δĝ|:", mean(absDiff).toFixed(3));
                console.log("var ĝ (A):", variance(gA).toFixed(3), "var ĝ (B):", variance(gB).toFixed(3));
                covA = staticRows.map(function (r) { return r.coverageMean; });
                covB = dynamicRows.map(function (r) { return r.coverageMean; });
                console.log("slope(conf~cov) A:", slopeXY(covA, cA).toFixed(3));
                console.log("slope(conf~cov) B:", slopeXY(covB, cB).toFixed(3));
                S = 1000000;
                rho = spearmanRho(gA.slice(0, S), gB.slice(0, S));
                console.log("Spearman rho (ĝ A vs B):", rho.toFixed(3));
                [3, 4, 5, 6].forEach(function (g) {
                    var vA = bandVar(staticRows, g);
                    var vB = bandVar(dynamicRows, g);
                    console.log("var \u011D in band \u00B10.25 around G".concat(g, ": A=").concat(vA.toFixed(4), " B=").concat(vB.toFixed(4)));
                });
                console.log("CSV written to ./results/static/results.csv and ./results/dynamic/results.csv");
                return [2 /*return*/];
        }
    });
}); })();
/**
 * Build the evaluator's expected memberships/features array
 * from the simple high-level MiniGameConfig + desired mode.
 * You can start with something basic and improve later.
 */
function configToMembershipArray(cfg, mode) {
    var _a;
    var dif = (_a = cfg.difficulty) !== null && _a !== void 0 ? _a : 2;
    // simple shift heuristic as discussed
    var baseShift = mode === "static" ? 0 : dif === 1 ? 0 : dif === 2 ? 5 : 10;
    var stepsShift = cfg.steps && cfg.steps >= 2 ? 5 : 0;
    var carryShift = cfg.carryBorrow ? 5 : 0;
    var shift = baseShift + stepsShift + carryShift;
    // return whatever your evaluator expects as the 3rd param
    // For example: per-axis triangular vertices [low, med, high]
    // Here’s a generic shape; tailor it to your evaluator’s expectations:
    var tri = function (a, b, c) { return ({ a: a, b: b, c: c }); };
    return [
        {
            axis: "arithmetic_fluency",
            low: tri(0 + shift, 0 + shift, 50 + shift),
            med: tri(30 + shift, 50 + shift, 70 + shift),
            high: tri(50 + shift, 100, 100)
        },
        {
            axis: "number_sense",
            low: tri(0 + shift, 0 + shift, 50 + shift),
            med: tri(30 + shift, 50 + shift, 70 + shift),
            high: tri(50 + shift, 100, 100)
        },
        {
            axis: "sequential_thinking",
            low: tri(0 + shift, 0 + shift, 50 + shift),
            med: tri(30 + shift, 50 + shift, 70 + shift),
            high: tri(50 + shift, 100, 100)
        },
        {
            axis: "comparison_skill",
            low: tri(0 + shift, 0 + shift, 50 + shift),
            med: tri(30 + shift, 50 + shift, 70 + shift),
            high: tri(50 + shift, 100, 100)
        },
        {
            axis: "visual_matching",
            low: tri(0 + shift, 0 + shift, 50 + shift),
            med: tri(30 + shift, 50 + shift, 70 + shift),
            high: tri(50 + shift, 100, 100)
        },
        {
            axis: "audio_recognition",
            low: tri(0 + shift, 0 + shift, 50 + shift),
            med: tri(30 + shift, 50 + shift, 70 + shift),
            high: tri(50 + shift, 100, 100)
        },
    ];
}
