/**
 * なにも変えないで！
 */
const CHARACTER_DEFINITION = {
    IGNORED: [' ', '\n'],
    SIGNS: ['+', '-'],
    NUMBER_CHARS: "0123456789".split(""),
    NUMBER_PARSER: (input) => {
        if (/^(?:[+-]?\d+(?:\.\d+)?(?:(?:[eE][+-]?\d+)|(?:\*10\^[+-]?\d+))?)|[+-]?Infinity|NaN$/g.test(input)) {
            return Number.parseFloat(input);
        }
        else {
            throw new EvaluationError("数値の解析に失敗しました: '" + input + "'");
        }
    },
    DECIMAL_POINT: '.',
    COMMA: ',',
    PARENTHESIS: ['(', ')'],
    UNDECLARABLE_CHARS: ['(', ')', ',']
};
/**
 * {@link ImmutableCalcExpEvaluator#evaluate()}から投げられるエラーのクラス
 */
export class EvaluationError extends Error {
    constructor(message, cause) {
        (cause === undefined) ? super(message) : super(message + "(cause: '" + String(cause) + "')", { cause });
    }
}
/**
 * {@link ImmutableRegistry}から投げられるエラーのクラス
 */
export class RegistryError extends Error {
    constructor(message, cause) {
        (cause === undefined) ? super(message) : super(message + "(cause: '" + String(cause) + "')", { cause });
    }
}
export var FunctionArgCount;
(function (FunctionArgCount) {
    /**
     * 引数なし
     */
    FunctionArgCount["NO"] = "NO";
    /**
     * 引数1つ
     */
    FunctionArgCount["ONE"] = "ONE";
    /**
     * 引数2つ
     */
    FunctionArgCount["TWO"] = "TWO";
    /**
     * 可変長引数
     */
    FunctionArgCount["VAR"] = "VAR";
})(FunctionArgCount || (FunctionArgCount = {}));
export var OperatorPriority;
(function (OperatorPriority) {
    /**
     * 多項間演算用(ex: +, -)
     */
    OperatorPriority["POLYNOMIAL"] = "POLYNOMIAL";
    /**
     * 単項間演算用(ex: *, /)
     */
    OperatorPriority["MONOMIAL"] = "MONOMIAL";
    /**
     * 因数間演算用(ex: **)
     */
    OperatorPriority["FACTOR"] = "FACTOR";
})(OperatorPriority || (OperatorPriority = {}));
/**
 * {@link ImmutableCalcExpEvaluator}の既存の定義を操作する際に使用する、定義カテゴリを表現するクラス
 */
class Declaration {
    input;
    constructor(input) {
        this.input = input;
    }
    static getInternalInput(declaration) {
        return { ...declaration.input };
    }
}
class FunctionDeclaration extends Declaration {
    argCount;
    constructor(def) {
        super(def);
        this.argCount = def.argCount;
    }
    call(args) {
        if (FunctionDeclaration.isNoArg(this.input)) {
            if (args.length === 0)
                return this.input.call();
            else
                throw new TypeError(`関数に渡された引数の数が正しくありません: 正=0, 誤=${args.length}`);
        }
        else if (FunctionDeclaration.isOneArg(this.input)) {
            if (args.length === 1)
                return this.input.call(args[0]);
            else
                throw new TypeError(`関数に渡された引数の数が正しくありません: 正=1, 誤=${args.length}`);
        }
        else if (FunctionDeclaration.isTwoArg(this.input)) {
            if (args.length === 2)
                return this.input.call(args[0], args[1]);
            else
                throw new TypeError(`関数に渡された引数の数が正しくありません: 正=2, 誤=${args.length}`);
        }
        else if (FunctionDeclaration.isVarArg(this.input)) {
            return this.input.call(args);
        }
        else {
            throw new Error("NEVER HAPPENS");
        }
    }
    static isNoArg(def) {
        return def.argCount === FunctionArgCount.NO;
    }
    static isOneArg(def) {
        return def.argCount === FunctionArgCount.ONE;
    }
    static isTwoArg(def) {
        return def.argCount === FunctionArgCount.TWO;
    }
    static isVarArg(def) {
        return def.argCount === FunctionArgCount.VAR;
    }
}
class OperatorDeclaration extends Declaration {
    priority;
    constructor(def) {
        super(def);
        this.priority = def.priority;
    }
    call(x, y) {
        return this.input.operate(x, y);
    }
}
class ConstantDeclaration extends Declaration {
    value;
    constructor(def) {
        super(def);
        this.value = def.value;
    }
}
export class RegistryKey {
    id;
    static keys = new Set();
    constructor(id) {
        this.id = id;
        RegistryKey.keys.add(this);
    }
    static values() {
        return new Set(this.keys);
    }
    /**
     * 定数のレジストリキー
     */
    static CONSTANT = new this("CONSTANT");
    /**
     * 関数のレジストリキー
     */
    static FUNCTION = new this("FUNCTION");
    /**
     * 演算子のレジストリキー
     */
    static OPERATOR = new this("OPERATOR");
}
class ImmutableRegistry {
    registryKey;
    converter;
    registry = new Map();
    /**
     * レジストリの参照に使用するオブジェクト
     */
    lookup = new RegistryLookup(this.registry);
    constructor(registryKey, converter) {
        this.registryKey = registryKey;
        this.converter = converter;
    }
    /**
     * レジストリに宣言を登録する関数
     * @param name 宣言名
     * @param value 登録する値
     */
    register(name, value) {
        if (CHARACTER_DEFINITION.UNDECLARABLE_CHARS.some(char => name.includes(char))) {
            throw new RegistryError(`定義名に無効な文字が含まれています: ${CHARACTER_DEFINITION.UNDECLARABLE_CHARS}`);
        }
        if (!this.registry.has(name)) {
            this.registry.set(name, this.converter(value));
        }
        else {
            throw new RegistryError(`既に定義名 "${name}" は存在します`);
        }
    }
    /**
     * レジストリに複数の宣言を登録する関数
     * @param values 複数の宣言
     */
    registerByDescriptor(values) {
        for (const name of Object.keys(values)) {
            const t = values[name];
            this.register(name, t);
        }
    }
    /**
     * レジストリに登録された宣言を削除する関数
     * @param name 宣言名
     */
    unregister(name) {
        if (this.registry.has(name)) {
            this.registry.delete(name);
        }
        else {
            throw new RegistryError(`定義名 "${name}" が見つかりませんでした`);
        }
    }
    writeTo(other, overwrite) {
        for (const { name, value } of this.lookup.getInNameLongestOrder()) {
            if (other.lookup.has(name)) {
                if (overwrite)
                    other.unregister(name);
                else
                    continue;
            }
            other.register(name, Declaration.getInternalInput(value));
        }
    }
}
class Registry extends ImmutableRegistry {
    register(name, value) {
        super.register(name, value);
    }
    registerByDescriptor(values) {
        super.registerByDescriptor(values);
    }
    unregister(name) {
        super.unregister(name);
    }
}
class RegistryLookup {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    /**
     * 指定の宣言名が存在するかを返す関数
     * @param name 宣言名
     * @returns 存在すれば `true`
     */
    has(name) {
        return this.registry.has(name);
    }
    /**
     * 宣言名から定義情報を返す関数
     * @param name 宣言名
     * @returns 定義情報
     * @throws 宣言名が見つからなかった場合
     */
    findByOnlyName(name) {
        if (this.registry.has(name)) {
            return this.registry.get(name);
        }
        else {
            throw new RegistryError(`定義名 "${name}" が見つかりませんでした`);
        }
    }
    /**
     * 宣言名と条件から定義情報を返す関数
     * @param name 宣言名
     * @param condition 条件
     * @returns 定義情報
     * @throws 宣言名が見つからなかった場合, 或いは条件を満たさなかった場合
     */
    find(name, condition) {
        const value = this.findByOnlyName(name);
        if (condition(value)) {
            return value;
        }
        else {
            throw new RegistryError(`定義名 "${name}" は存在しますが、渡された条件に一致しません`);
        }
    }
    /**
     * 条件に一致するオブジェクト(宣言名と定義情報の双方を含む)を宣言名文字列の長い順で返す関数
     * @param filter 条件
     * @returns 宣言名と定義情報の双方を含むオブジェクトのソート済み配列
     */
    getInNameLongestOrder(filter) {
        const list = [];
        for (const name of [...this.registry.keys()].sort((a, b) => b.length - a.length)) {
            const value = this.findByOnlyName(name);
            let result;
            if (filter === undefined) {
                result = { name, value };
            }
            else if (filter(value)) {
                result = { name, value };
            }
            else {
                continue;
            }
            list.push(result);
        }
        return list;
    }
}
class ImmutableRegistries {
    registries = new Map();
    constructor(registries) {
        const constantReg = this.create(RegistryKey.CONSTANT, cons => new ConstantDeclaration(cons));
        const funcReg = this.create(RegistryKey.FUNCTION, func => new FunctionDeclaration(func));
        const operatorReg = this.create(RegistryKey.OPERATOR, oper => new OperatorDeclaration(oper));
        if (registries) {
            registries.get(RegistryKey.CONSTANT).lookup.getInNameLongestOrder().forEach(val => {
                constantReg.register(val.name, Declaration.getInternalInput(val.value));
            });
            registries.get(RegistryKey.FUNCTION).lookup.getInNameLongestOrder().forEach(val => {
                funcReg.register(val.name, Declaration.getInternalInput(val.value));
            });
            registries.get(RegistryKey.OPERATOR).lookup.getInNameLongestOrder().forEach(val => {
                operatorReg.register(val.name, Declaration.getInternalInput(val.value));
            });
        }
    }
    create(key, converter) {
        if (!this.registries.has(key)) {
            const registry = new Registry(key, converter);
            this.registries.set(key, registry);
            return registry;
        }
        else {
            throw new RegistryError(`既にレジストリ "${key.id}" は存在します`);
        }
    }
    /**
     * 指定のキーに対応するレジストリを返す関数
     * @param key レジストリキー
     * @returns 対応するレジストリ
     * @throws レジストリキーに対応するレジストリが見つからなかった場合
     */
    get(key) {
        if (this.registries.has(key)) {
            return this.registries.get(key);
        }
        else {
            throw new RegistryError(`レジストリ "${key.id}" が見つかりませんでした`);
        }
    }
    /**
     * 他のミュータブルインスタンスに自身と同じ情報を書き込む関数
     * @param other 他のインスタンス
     * @param overwrite `true` の場合, 渡されたインスタンスの状態を無視して定義を上書きする
     */
    writeTo(other, overwrite) {
        for (const [registryKey, registry] of this.registries) {
            registry.writeTo(other.get(registryKey), overwrite);
        }
    }
}
export class Registries extends ImmutableRegistries {
    constructor(registires) {
        if (registires)
            super(registires);
        else
            super();
    }
    get(key) {
        return super.get(key);
    }
    /**
     * 読み取り専用のコピーを作成する関数
     * @returns 作成されたインスタンス
     */
    toImmutable() {
        return new ImmutableRegistries(this);
    }
    /**
     * 基本的な演算子や定数・関数の定義が既に行われた読み取り専用レジストリ
     */
    static DEFAULT = (() => {
        const registries = new Registries();
        registries.get(RegistryKey.OPERATOR).registerByDescriptor({
            "+": {
                priority: OperatorPriority.POLYNOMIAL,
                operate(x, y) {
                    return x + y;
                }
            },
            "-": {
                priority: OperatorPriority.POLYNOMIAL,
                operate(x, y) {
                    return x - y;
                }
            },
            "*": {
                priority: OperatorPriority.MONOMIAL,
                operate(x, y) {
                    return x * y;
                }
            },
            "/": {
                priority: OperatorPriority.MONOMIAL,
                operate(x, y) {
                    return x / y;
                }
            },
            "%": {
                priority: OperatorPriority.MONOMIAL,
                operate(x, y) {
                    return x % y;
                }
            },
            "**": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    return x ** y;
                }
            },
            "&": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y)))
                        throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x & y;
                }
            },
            "|": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y)))
                        throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x | y;
                }
            },
            "^": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y)))
                        throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x ^ y;
                }
            },
            "<<": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y)))
                        throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x << y;
                }
            },
            ">>": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y)))
                        throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x >> y;
                }
            },
            ">>>": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y)))
                        throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x >>> y;
                }
            }
        });
        registries.get(RegistryKey.CONSTANT).registerByDescriptor({
            "NaN": {
                value: NaN
            },
            "PI": {
                value: Math.PI
            },
            "TAU": {
                value: Math.PI * 2
            },
            "E": {
                value: Math.E
            },
            "Infinity": {
                value: Infinity
            }
        });
        registries.get(RegistryKey.FUNCTION).registerByDescriptor({
            "random": {
                argCount: FunctionArgCount.NO,
                call: Math.random
            },
            "sqrt": {
                argCount: FunctionArgCount.ONE,
                call: Math.sqrt
            },
            "cbrt": {
                argCount: FunctionArgCount.ONE,
                call: Math.cbrt
            },
            "abs": {
                argCount: FunctionArgCount.ONE,
                call: Math.abs
            },
            "floor": {
                argCount: FunctionArgCount.ONE,
                call: Math.floor
            },
            "ceil": {
                argCount: FunctionArgCount.ONE,
                call: Math.ceil
            },
            "round": {
                argCount: FunctionArgCount.ONE,
                call: Math.round
            },
            "sin": {
                argCount: FunctionArgCount.ONE,
                call: Math.sin
            },
            "cos": {
                argCount: FunctionArgCount.ONE,
                call: Math.cos
            },
            "tan": {
                argCount: FunctionArgCount.ONE,
                call: Math.tan
            },
            "asin": {
                argCount: FunctionArgCount.ONE,
                call: Math.asin
            },
            "acos": {
                argCount: FunctionArgCount.ONE,
                call: Math.acos
            },
            "atan": {
                argCount: FunctionArgCount.ONE,
                call: Math.atan
            },
            "exp": {
                argCount: FunctionArgCount.ONE,
                call: Math.exp
            },
            "to_degrees": {
                argCount: FunctionArgCount.ONE,
                call(rad) {
                    return rad * 180 / Math.PI;
                }
            },
            "to_radians": {
                argCount: FunctionArgCount.ONE,
                call(deg) {
                    return deg * Math.PI / 180;
                }
            },
            "log10": {
                argCount: FunctionArgCount.ONE,
                call: Math.log10
            },
            "factorial": {
                argCount: FunctionArgCount.ONE,
                call(x) {
                    if (!Number.isInteger(x))
                        throw new TypeError("階乗は実質的な整数の値にのみ使用できます");
                    else if (x < 0)
                        throw new TypeError("階乗は負の値に使用できません");
                    else if (x > 127)
                        throw new TypeError("階乗は負荷軽減のため、127!を超えた値を計算できないよう制限されています");
                    let result = 1;
                    for (let i = 2; i <= x; i++) {
                        result *= i;
                    }
                    return result;
                }
            },
            "log": {
                argCount: FunctionArgCount.TWO,
                call: Math.log
            },
            "atan2": {
                argCount: FunctionArgCount.TWO,
                call: Math.atan2
            },
            "min": {
                argCount: FunctionArgCount.TWO,
                call: Math.min
            },
            "max": {
                argCount: FunctionArgCount.TWO,
                call: Math.max
            },
            "pow": {
                argCount: FunctionArgCount.TWO,
                call: Math.pow
            }
        });
        return new ImmutableRegistries(registries);
    })();
}
;
/**
 * 定義を外部から追加・変更・削除することができない{@link CalcExpEvaluator}のクラス
 */
export class ImmutableCalcExpEvaluator {
    static DEFAULT_CONFIGURATION = {
        allowNaN: false,
        neverThrows: false
    };
    static mergeWithDefaultConfiguration(input) {
        return { ...this.DEFAULT_CONFIGURATION, ...input };
    }
    /**
     * 宣言のレジストリを纏めたオブジェクト
     */
    registries;
    /**
     * このインスタンスの設定
     */
    configuration;
    expression = "";
    location = 0;
    constructor(options) {
        this.configuration = ImmutableCalcExpEvaluator.mergeWithDefaultConfiguration(options?.configuration);
        this.registries = options?.copySourceRegistries === undefined ? new Registries().toImmutable() : new Registries(options.copySourceRegistries).toImmutable();
    }
    isOver() {
        return this.location >= this.expression.length;
    }
    next(next = true) {
        if (typeof next === "boolean") {
            if (this.isOver()) {
                throw new EvaluationError("文字数を超えた位置へのアクセスが発生しました");
            }
            const current = this.expression.charAt(this.location++);
            if (CHARACTER_DEFINITION.IGNORED.includes(current) && next)
                return this.next();
            return current;
        }
        else {
            if (this.isOver())
                return false;
            this.ignore();
            const str = this.expression.substring(this.location);
            if (str.startsWith(next)) {
                this.location += next.length;
                this.ignore();
                return true;
            }
            return false;
        }
    }
    back() {
        this.location--;
    }
    ignore() {
        if (this.isOver())
            return;
        const current = this.expression.charAt(this.location++);
        if (CHARACTER_DEFINITION.IGNORED.includes(current)) {
            this.ignore();
        }
        else {
            this.back();
        }
    }
    test(...nexts) {
        const loc = this.location;
        for (const next of nexts) {
            if (!this.next(next)) {
                this.location = loc;
                return false;
            }
        }
        this.location = loc;
        return true;
    }
    number() {
        let string = "";
        for (const signChar of CHARACTER_DEFINITION.SIGNS) {
            if (this.next(signChar)) {
                string += signChar;
                break;
            }
        }
        if (this.isFunction()) {
            try {
                const returnValue = this.getFunction().call(this.arguments());
                if (typeof returnValue !== "number") {
                    throw new EvaluationError("関数の戻り値の型が無効です: " + typeof returnValue);
                }
                string += returnValue;
            }
            catch (e) {
                throw new EvaluationError("関数の呼び出しで例外が発生しました", e);
            }
        }
        else if (this.isConst()) {
            const returnValue = this.getConst().value;
            if (typeof returnValue !== "number") {
                throw new EvaluationError("定数から取り出された値の型が無効です: " + typeof returnValue);
            }
            string += returnValue;
        }
        else if (CHARACTER_DEFINITION.SIGNS.some(sign => this.test(sign)) || this.test(CHARACTER_DEFINITION.PARENTHESIS[0])) {
            const value = this.polynomial();
            if (string.length === 0) {
                string += value.toString();
            }
            else {
                const signChar = string.charAt(0);
                string = this.applySign(value, signChar).toString();
            }
        }
        else {
            let dotAlreadyAppended = false;
            while (!this.isOver()) {
                const current = this.next(false);
                if (CHARACTER_DEFINITION.NUMBER_CHARS.includes(current)) {
                    string += current;
                }
                else if (current == CHARACTER_DEFINITION.DECIMAL_POINT) {
                    if (dotAlreadyAppended) {
                        throw new EvaluationError("無効な小数点を検知しました");
                    }
                    string += current;
                    dotAlreadyAppended = true;
                }
                else {
                    this.back();
                    break;
                }
            }
        }
        return CHARACTER_DEFINITION.NUMBER_PARSER(string);
    }
    applySign(value, sign) {
        if (CHARACTER_DEFINITION.SIGNS[0] === sign) {
            return value;
        }
        else if (CHARACTER_DEFINITION.SIGNS[1] === sign) {
            return -value;
        }
        else {
            throw new EvaluationError("'" + sign + "'は無効な符号です");
        }
    }
    monomial() {
        let value = this.operateWithAnotherFactor(this.factor());
        a: while (!this.isOver()) {
            const operators = this.registries.get(RegistryKey.OPERATOR).lookup.getInNameLongestOrder(v => v.priority === OperatorPriority.MONOMIAL);
            for (const operator of operators) {
                if (this.next(operator.name)) {
                    const declaration = operator.value;
                    try {
                        value = declaration.call(value, this.operateWithAnotherFactor(this.factor()));
                    }
                    catch (e) {
                        throw new EvaluationError("単項間演算子が例外を投げました", e);
                    }
                    continue a;
                }
            }
            break;
        }
        return value;
    }
    polynomial() {
        let value = this.monomial();
        a: while (!this.isOver()) {
            const operators = this.registries.get(RegistryKey.OPERATOR).lookup.getInNameLongestOrder(v => v.priority === OperatorPriority.POLYNOMIAL);
            for (const operator of operators) {
                if (this.next(operator.name)) {
                    const declaration = operator.value;
                    try {
                        value = declaration.call(value, this.monomial());
                    }
                    catch (e) {
                        throw new EvaluationError("多項間演算子が例外を投げました", e);
                    }
                    continue a;
                }
            }
            break;
        }
        return value;
    }
    operateWithAnotherFactor(num) {
        let value = num;
        a: while (!this.isOver()) {
            const operators = this.registries.get(RegistryKey.OPERATOR).lookup.getInNameLongestOrder(v => v.priority === OperatorPriority.FACTOR);
            for (const operator of operators) {
                if (this.next(operator.name)) {
                    const declaration = operator.value;
                    const obj = this.factor();
                    try {
                        value = declaration.call(value, obj);
                    }
                    catch (e) {
                        throw new EvaluationError("因数間演算子が例外を投げました", e);
                    }
                    continue a;
                }
            }
            break;
        }
        return value;
    }
    factor() {
        const current = this.next();
        if (current == CHARACTER_DEFINITION.PARENTHESIS[0]) {
            let value = this.polynomial();
            if (this.isOver()) {
                throw new EvaluationError("括弧が閉じられていません");
            }
            const next = this.next();
            if (next == CHARACTER_DEFINITION.PARENTHESIS[1]) {
                this.ignore();
                return value;
            }
            else {
                throw new EvaluationError("括弧が閉じられていません: " + next);
            }
        }
        else {
            this.back();
            return this.number();
        }
    }
    arguments() {
        const args = [];
        if (!this.next(CHARACTER_DEFINITION.PARENTHESIS[0])) {
            throw new EvaluationError("関数の呼び出しには括弧が必要です");
        }
        if (this.next(CHARACTER_DEFINITION.PARENTHESIS[1])) {
            return args;
        }
        while (true) {
            if (this.isOver()) {
                throw new EvaluationError("引数の探索中に文字列外に来ました");
            }
            let value = this.polynomial();
            const next = this.next();
            if (next == CHARACTER_DEFINITION.COMMA) {
                args.push(value);
            }
            else if (next == CHARACTER_DEFINITION.PARENTHESIS[1]) {
                args.push(value);
                this.ignore();
                return args;
            }
            else {
                throw new EvaluationError("関数の引数の区切りが見つかりません: " + next);
            }
        }
    }
    isConst() {
        for (const constant of this.registries.get(RegistryKey.CONSTANT).lookup.getInNameLongestOrder()) {
            if (this.test(constant.name)) {
                return true;
            }
        }
        return false;
    }
    getConst() {
        for (const constant of this.registries.get(RegistryKey.CONSTANT).lookup.getInNameLongestOrder()) {
            if (this.next(constant.name)) {
                return constant.value;
            }
        }
        throw new EvaluationError("定数を取得できませんでした");
    }
    isFunction() {
        for (const func of this.registries.get(RegistryKey.FUNCTION).lookup.getInNameLongestOrder()) {
            if (this.test(func.name, CHARACTER_DEFINITION.PARENTHESIS[0])) {
                return true;
            }
        }
        return false;
    }
    getFunction() {
        for (const func of this.registries.get(RegistryKey.FUNCTION).lookup.getInNameLongestOrder()) {
            if (this.test(func.name, CHARACTER_DEFINITION.PARENTHESIS[0])) {
                this.next(func.name);
                return func.value;
            }
        }
        throw new EvaluationError("関数を取得できませんでした");
    }
    index() {
        if (this.location != 0) {
            throw new EvaluationError("カーソル位置が0ではありませんでした インスタンス自身がevaluate()を呼び出した可能性があります");
        }
        if (this.isOver()) {
            throw new EvaluationError("空文字は計算できません");
        }
        const value = this.polynomial();
        if (this.expression.substring(this.location).length !== 0) {
            throw new EvaluationError("式の終了後に無効な文字を検出しました");
        }
        return value;
    }
    /**
     * 引数に渡された文字列を式として評価する関数
     * @param expression 式
     * @returns 計算結果
     * @throws 文字列の解析に失敗するか、{@link ImmutableEvaluatorConfiguration#allowNaN}が `false` の状態で `NaN` が出力された場合
     */
    evaluate(expression) {
        this.expression = expression;
        const nanError = new EvaluationError("式からNaNが出力されました");
        ;
        try {
            const value = this.index();
            if (Number.isNaN(value) && !this.configuration.allowNaN) {
                throw nanError;
            }
            return value;
        }
        catch (e) {
            if (this.configuration.allowNaN && this.configuration.neverThrows) {
                return NaN;
            }
            else if (!this.configuration.allowNaN) {
                throw nanError;
            }
            else {
                throw e;
            }
        }
        finally {
            this.location = 0;
            this.expression = "";
        }
    }
    /**
     * 定義を全てコピーした新しいインスタンスを作成する関数
     * @returns このインスタンスの新しいクローン
     */
    clone() {
        return new ImmutableCalcExpEvaluator({
            configuration: this.configuration,
            copySourceRegistries: this.registries
        });
    }
}
export class CalcExpEvaluator extends ImmutableCalcExpEvaluator {
    configuration;
    registries;
    constructor(options) {
        super(options);
        this.configuration = ImmutableCalcExpEvaluator.mergeWithDefaultConfiguration(options?.configuration);
        this.registries = options?.copySourceRegistries === undefined ? new Registries() : new Registries(options.copySourceRegistries);
    }
    clone() {
        return new CalcExpEvaluator({
            configuration: this.configuration,
            copySourceRegistries: this.registries
        });
    }
}
