interface CharacterDefinition {
    readonly IGNORED: readonly string[];

    readonly SIGNS: readonly [string, string];

    readonly NUMBER_CHARS: readonly string[];

    readonly NUMBER_PARSER: (input: string) => number;

    readonly DECIMAL_POINT: string;

    readonly COMMA: string;

    readonly PARENTHESIS: readonly [string, string];
}

/**
 * なにも変えないで！
 */
const CHARACTER_DEFINITION: CharacterDefinition = {
    IGNORED: [' ', '\n'],
    SIGNS: ['+', '-'],
    NUMBER_CHARS: "0123456789".split(""),
    NUMBER_PARSER: (input: string) => {
        if (/^(?:[+-]?\d+(?:\.\d+)?(?:(?:[eE][+-]?\d+)|(?:\*10\^[+-]?\d+))?)|[+-]?Infinity|NaN$/g.test(input)) {
            return Number.parseFloat(input);
        }
        else {
            throw new CalcExpEvaluationError("数値の解析に失敗しました: '" + input + "'");
        }
    },
    DECIMAL_POINT: '.',
    COMMA: ',',
    PARENTHESIS: ['(', ')']
};

/**
 * {@link ImmutableCalcExpEvaluator#evaluate()}から投げられるエラーのクラス
 */
export class CalcExpEvaluationError extends Error {
    public constructor(message: string, cause?: unknown) {
        (cause === undefined) ? super(message) : super(message, { cause });
    }
}

export interface ImmutableEvaluatorConfiguration {
    /**
     * 真の場合、計算結果が`NaN`になることを許容します    
     * デフォルトでは`false`です
     */
    readonly allowNaN: boolean;
}

export interface MutableEvaluatorConfiguration extends ImmutableEvaluatorConfiguration {
    /**
     * 真の場合、計算結果が`NaN`になることを許容します    
     * デフォルトでは`false`です
     */
    allowNaN: boolean;
}

export enum FunctionArgCount {
    NO = "NO",
    ONE = "ONE",
    TWO = "TWO",
    VAR = "VAR"
}

export enum OperatorPriority {
    POLYNOMIAL = "POLYNOMIAL",
    MONOMIAL = "MONOMIAL",
    FACTOR = "FACTOR"
}

type FunctionTypeLookup = {
    [FunctionArgCount.NO]: () => number;
    [FunctionArgCount.ONE]: (x: number) => number;
    [FunctionArgCount.TWO]: (x: number, y: number) => number;
    [FunctionArgCount.VAR]: (args: number[]) => number;
}

interface FunctionDef<T extends FunctionArgCount> {
    readonly argCount: T;

    readonly call: FunctionTypeLookup[T];
}

interface OperatorDef<T extends OperatorPriority> {
    operate(x: number, y: number): number;

    readonly priority: T;
}

type FunctionDefUnion<T = FunctionArgCount> = T extends FunctionArgCount ? FunctionDef<T> : never;

type OperatorDefUnion<T = OperatorPriority> = T extends OperatorPriority ? OperatorDef<T> : never;

/**
 * {@link ImmutableCalcExpEvaluator}の既存の定義を操作する際に使用する、定義カテゴリを表現するクラス
 */
export abstract class Declaration<T> {
    protected constructor(protected readonly def: T) {}
}

export class FunctionDeclaration extends Declaration<FunctionDefUnion> {
    public readonly argCount: FunctionArgCount;

    public constructor(def: FunctionDefUnion) {
        super(def);
        this.argCount = def.argCount;
    }

    public call(args: number[]): number {
        if (FunctionDeclaration.isNoArg(this.def)) {
            if (args.length === 0) return this.def.call();
            else throw new CalcExpEvaluationError("");
        }
        else if (FunctionDeclaration.isOneArg(this.def)) {
            if (args.length === 1) return this.def.call(args[0]);
            else throw new CalcExpEvaluationError("");
        }
        else if (FunctionDeclaration.isTwoArg(this.def)) {
            if (args.length === 2) return this.def.call(args[0], args[1]);
            else throw new CalcExpEvaluationError("");
        }
        else if (FunctionDeclaration.isVarArg(this.def)) {
            return this.def.call(args);
        }
        else {
            throw new Error();
        }
    }

    private static isNoArg(def: FunctionDefUnion): def is FunctionDef<FunctionArgCount.NO> {
        return def.argCount === FunctionArgCount.NO;
    }

    private static isOneArg(def: FunctionDefUnion): def is FunctionDef<FunctionArgCount.ONE> {
        return def.argCount === FunctionArgCount.ONE;
    }

    private static isTwoArg(def: FunctionDefUnion): def is FunctionDef<FunctionArgCount.TWO> {
        return def.argCount === FunctionArgCount.TWO;
    }

    private static isVarArg(def: FunctionDefUnion): def is FunctionDef<FunctionArgCount.VAR> {
        return def.argCount === FunctionArgCount.VAR;
    }
}

export class OperatorDeclaration extends Declaration<OperatorDefUnion> {
    public readonly priority: OperatorPriority;

    public constructor(def: OperatorDefUnion) {
        super(def);
        this.priority = def.priority;
    }

    public call(x: number, y: number): number {
        return this.def.operate(x, y);
    }
}

export class ConstantDeclaration extends Declaration<number> {
    public readonly value: number;

    public constructor(def: number) {
        super(def);
        this.value = def;
    }
}

export class RegistryKey<T, U> {
    private constructor(public readonly id: string) {}

    public static readonly CONSTANT = new this<number, ConstantDeclaration>("CONSTANT");

    public static readonly FUNCTION = new this<FunctionDefUnion, FunctionDeclaration>("FUNCTION");

    public static readonly OPERATOR = new this<OperatorDefUnion, OperatorDeclaration>("OPERATOR");
}

class ImmutableRegistry<T, U> {
    private readonly registry: Map<string, U> = new Map();

    public readonly lookup: RegistryLookup<U> = new RegistryLookup(this.registry);

    public constructor(private readonly registryKey: RegistryKey<T, U>, private readonly converter: (input: T) => U) {

    }

    protected register(name: string, value: T): void {
        if (!this.registry.has(name)) {
            this.registry.set(name, this.converter(value));
        }
        else {
            throw new Error();
        }
    }

    protected registerMultiple(values: Record<string, T>) {
        for (const name of Object.keys(values)) {
            const t = values[name];
            this.register(name, t);
        }
    }

    protected unregister(name: string): void {
        if (this.registry.has(name)) {
            this.registry.delete(name);
        }
        else {
            throw new Error();
        }
    }

    public has(name: string): boolean {
        return this.registry.has(name);
    }

    public getAll(): ReadonlySet<string> {
        return new Set(this.registry.keys());
    }
}

class Registry<T, U> extends ImmutableRegistry<T, U> {
    public override register(name: string, value: T): void {
        super.register(name, value);
    }

    public override registerMultiple(values: Record<string, T>): void {
        super.registerMultiple(values);
    }

    public override unregister(name: string): void {
        super.unregister(name);
    }
}

class RegistryLookup<T> {
    public constructor(private readonly registry: Map<string, T>) {

    }

    public findByOnlyName(name: string): T {
        if (this.registry.has(name)) {
            return this.registry.get(name)!;
        }
        else {
            throw new Error();
        }
    }

    public find(name: string, condition: (value: T) => boolean): T {
        const value = this.findByOnlyName(name);

        if (condition(value)) {
            return value;
        }
        else {
            throw new Error();
        }
    }

    public getInLongestOrder(filter?: (value: T) => boolean): ({ readonly name: string; readonly value: T })[] {
        const list: ({ readonly name: string; readonly value: T })[] = [];

        for (const name of [...this.registry.keys()].sort((a, b) => b.length - a.length)) {
            list.push({
                name,
                value: filter === undefined ? this.findByOnlyName(name) : this.find(name, filter)
            });
        }

        return list;
    }
}

class ImmutableRegistries {
    private readonly registries: Map<RegistryKey<unknown, unknown>, Registry<unknown, unknown>> = new Map();

    public constructor() {
        this.create(RegistryKey.CONSTANT, number => new ConstantDeclaration(number));
        this.create(RegistryKey.FUNCTION, func => new FunctionDeclaration(func));
        this.create(RegistryKey.OPERATOR, oper => new OperatorDeclaration(oper));
    }

    private create<T, U>(key: RegistryKey<T, U>, converter: (input: T) => U): Registry<T, U> {
        if (!this.registries.has(key)) {
            const registry = new Registry(key, converter);
            this.registries.set(key, registry as Registry<unknown, unknown>);
            return registry;
        }
        else {
            throw new Error();
        }
    }

    public get<T, U>(key: RegistryKey<T, U>): ImmutableRegistry<T, U> {
        if (this.registries.has(key)) {
            return this.registries.get(key) as ImmutableRegistry<T, U>;
        }
        else {
            throw new Error();
        }
    }

    public copyTo(other: Registries, overwrite: boolean): void {
        for (const [registryKey, registry] of this.registries) {
            for (const name of registry.getAll()) {
                const otherRegistry = other.get(registryKey);
                if (otherRegistry.has(name) && overwrite) {
                    otherRegistry.unregister(name);
                    otherRegistry.register(name, registry.lookup.findByOnlyName(name));
                }
                else {
                    otherRegistry.register(name, registry.lookup.findByOnlyName(name));
                }
            }
        }
    }
}

class Registries extends ImmutableRegistries {
    public override get<T, U>(key: RegistryKey<T, U>): Registry<T, U> {
        return super.get(key) as Registry<T, U>;
    }
}

/**
 * 定義を外部から追加・変更・削除することができない{@link CalcExpEvaluator}のクラス
 */
export class ImmutableCalcExpEvaluator {
    protected static readonly CONFIGURATION_DEFAULT: ImmutableEvaluatorConfiguration = {
        allowNaN: false
    };

    public readonly registries: ImmutableRegistries;

    public readonly configuration: ImmutableEvaluatorConfiguration;

    private expression: string = "";

    private location: number = 0;

    protected constructor(config: ImmutableEvaluatorConfiguration, registries: ImmutableRegistries) {
        this.configuration = config;
        this.registries = registries;
    }

    private isOver(): boolean {
        return this.location >= this.expression.length
    }

    private next(): string;

    private next(next: string): string;

    private next(next: boolean): string;

    private next(next: string | boolean = true): string | boolean {
        if (typeof next === "boolean") {
            if (this.isOver()) {
                throw new CalcExpEvaluationError("文字数を超えた位置へのアクセスが発生しました");
            }

            const current: string = this.expression.charAt(this.location++);
    
            if (CHARACTER_DEFINITION.IGNORED.includes(current) && next) return this.next();
    
            return current;
        }
        else {
            if (this.isOver()) return false;

            this.ignore();

            const str: string = this.expression.substring(this.location);

            if (str.startsWith(next)) {
                this.location += next.length;
                this.ignore();
                return true;
            }

            return false;
        }
    }

    private back(): void {
        this.location--;
    }

    private ignore(): void {
        if (this.isOver()) return;

        const current: string = this.expression.charAt(this.location++);

        if (CHARACTER_DEFINITION.IGNORED.includes(current)) {
            this.ignore();
        }
        else {
            this.back();
        }
    }

    private test(...nexts: string[]): boolean {
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

    private number(): number {
        let string: string = "";

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
                    throw new CalcExpEvaluationError("関数の戻り値の型が無効です: " + typeof returnValue);
                }

                string += returnValue;
            }
            catch (e) {
                throw new CalcExpEvaluationError("関数の呼び出しで例外が発生しました", e);
            }
        }
        else if (this.isConst()) {
            const returnValue = this.getConst().value;

            if (typeof returnValue !== "number") {
                throw new CalcExpEvaluationError("定数から取り出された値の型が無効です: " + typeof returnValue);
            }

            string += returnValue;
        }
        else if (CHARACTER_DEFINITION.SIGNS.some(sign => this.test(sign)) || this.test(CHARACTER_DEFINITION.PARENTHESIS[0])) {
            const value: number = this.polynomial();

            if (string.length === 0) {
                string += value.toString();
            }
            else {
                const signChar: string = string.charAt(0);
                string = this.applySign(value, signChar).toString();
            }
        }
        else {
            let dotAlreadyAppended: boolean = false;
            while (!this.isOver()) {
                const current: string = this.next(false);

                if (CHARACTER_DEFINITION.NUMBER_CHARS.includes(current)) {
                    string += current;
                }
                else if (current == CHARACTER_DEFINITION.DECIMAL_POINT) {
                    if (dotAlreadyAppended) {
                        throw new CalcExpEvaluationError("無効な小数点を検知しました");
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

    private applySign(value: number, sign: string): number {
        if (CHARACTER_DEFINITION.SIGNS[0] === sign) {
            return value;
        }
        else if (CHARACTER_DEFINITION.SIGNS[1] === sign) {
            return -value;
        }
        else {
            throw new CalcExpEvaluationError("'" + sign + "'は無効な符号です");
        }
    }

    private monomial(): number {
        let value: number = this.operateWithAnotherFactor(this.factor());

        a: while (!this.isOver()) {
            const operators = this.registries.get(RegistryKey.OPERATOR).lookup.getInLongestOrder(v => v.priority === OperatorPriority.MONOMIAL);

            for (const operator of operators) {
                if (this.next(operator.name)) {
                    const declaration = operator.value;

                    try {
                        value = declaration.call(value, this.operateWithAnotherFactor(this.factor()));
                    }
                    catch (e) {
                        throw new CalcExpEvaluationError("単項間演算子が例外を投げました", e)
                    }
                    continue a;
                }
            }
            break;
        }

        return value;
    }

    private polynomial(): number {
        let value: number = this.monomial();

        a: while (!this.isOver()) {
            const operators = this.registries.get(RegistryKey.OPERATOR).lookup.getInLongestOrder(v => v.priority === OperatorPriority.POLYNOMIAL);

            for (const operator of operators) {
                if (this.next(operator.name)) {
                    const declaration = operator.value;

                    try {
                        value = declaration.call(value, this.monomial());
                    }
                    catch (e) {
                        throw new CalcExpEvaluationError("多項間演算子が例外を投げました", e);
                    }
                    continue a;
                }
            }
            break;
        }

        return value;
    }

    private operateWithAnotherFactor(num: number): number {
        let value: number = num;

        a: while (!this.isOver()) {
            const operators = this.registries.get(RegistryKey.OPERATOR).lookup.getInLongestOrder(v => v.priority === OperatorPriority.FACTOR);

            for (const operator of operators) {
                if (this.next(operator.name)) {
                    const declaration = operator.value;

                    const obj: number = this.factor();

                    try {
                        value = declaration.call(value, obj);
                    }
                    catch (e) {
                        throw new CalcExpEvaluationError("因数間演算子が例外を投げました", e);
                    }
                    continue a;
                }
            }

            break;
        }

        return value;
    }

    private factor(): number {
        const current: string = this.next();

        if (current == CHARACTER_DEFINITION.PARENTHESIS[0]) {
            let value: number = this.polynomial();

            if (this.isOver()) {
                throw new CalcExpEvaluationError("括弧が閉じられていません");
            }

            const next: string = this.next();

            if (next == CHARACTER_DEFINITION.PARENTHESIS[1]) {
                this.ignore();
                return value;
            }
            else {
                throw new CalcExpEvaluationError("括弧が閉じられていません: " + next);
            }
        }
        else {
            this.back();
            return this.number();
        }
    }

    private arguments(): number[] {
        const args: number[] = [];

        if (!this.next(CHARACTER_DEFINITION.PARENTHESIS[0])) {
            throw new CalcExpEvaluationError("関数の呼び出しには括弧が必要です");
        }

        if (this.next(CHARACTER_DEFINITION.PARENTHESIS[1])) {
            return args;
        }

        while (true) {
            if (this.isOver()) {
                throw new CalcExpEvaluationError("引数の探索中に文字列外に来ました");
            }

            let value: number = this.polynomial();
            const next: string = this.next();

            if (next == CHARACTER_DEFINITION.COMMA) {
                args.push(value);
            }
            else if (next == CHARACTER_DEFINITION.PARENTHESIS[1]) {
                args.push(value);
                this.ignore();
                return args;
            }
            else {
                throw new CalcExpEvaluationError("関数の引数の区切りが見つかりません: " + next);
            }
        }
    }

    private isConst(): boolean {
        for (const constant of this.registries.get(RegistryKey.CONSTANT).lookup.getInLongestOrder()) {
            if (this.test(constant.name)) {
                return true;
            }
        }

        return false;
    }

    private getConst(): ConstantDeclaration {
        for (const constant of this.registries.get(RegistryKey.CONSTANT).lookup.getInLongestOrder()) {
            if (this.next(constant.name)) {
                return constant.value;
            }
        }

        throw new CalcExpEvaluationError("定数を取得できませんでした");
    }

    private isFunction(): boolean {
        for (const func of this.registries.get(RegistryKey.FUNCTION).lookup.getInLongestOrder()) {
            if (this.test(func.name, CHARACTER_DEFINITION.PARENTHESIS[0])) {
                return true;
            }
        }

        return false;
    }

    private getFunction(): FunctionDeclaration {
        for (const func of this.registries.get(RegistryKey.FUNCTION).lookup.getInLongestOrder()) {
            if (this.test(func.name, CHARACTER_DEFINITION.PARENTHESIS[0])) {
                this.next(func.name);
                return func.value;
            }
        }

        throw new CalcExpEvaluationError("関数を取得できませんでした");
    }

    private index(): number {
        if (this.location != 0) {
            throw new CalcExpEvaluationError("カーソル位置が0ではありませんでした インスタンス自身がevaluate()を呼び出した可能性があります");
        }

        if (this.isOver()) {
            throw new CalcExpEvaluationError("空文字は計算できません");
        }

        const value: number = this.polynomial();

        if (this.expression.substring(this.location).length !== 0) {
            throw new CalcExpEvaluationError("式の終了後に無効な文字を検出しました");
        }

        return value;
    }

    /**
     * 引数に渡された文字列を式として評価します
     * @param expression 式
     * @returns 計算結果
     * @throws 文字列の解析に失敗するか、{@link ImmutableEvaluatorConfiguration#allowNaN}が`false`の状態で`NaN`が出力された際に{@link CalcExpEvaluationError}をthrowします
     */
    public evaluate(expression: string): number {
        this.expression = expression;

        try {
            const value: number = this.index();

            if (Number.isNaN(value) && !this.configuration.allowNaN) {
                throw new CalcExpEvaluationError("式からNaNが出力されました");
            }

            return value;
        }
        catch (e) {
            throw e;
        }
        finally {
            this.location = 0;
            this.expression = "";
        }
    }

    /**
     * 定義を全てコピーした新しいインスタンスを作成します
     * @returns このインスタンスの新しいクローン
     */
    public clone(): ImmutableCalcExpEvaluator {
        const newRegistries = new Registries();
        this.registries.copyTo(newRegistries, true);
        const clone = new ImmutableCalcExpEvaluator(this.configuration, newRegistries);
        return clone;
    }

    /**
     * 定義を外部から追加・変更・削除することができない{@link CalcExpEvaluator}のインスタンスを作成します
     * @param initializer 初期化子
     * @returns 新しい{@link ImmutableCalcExpEvaluator}のインスタンス
     */
    public static newImmutableEvaluator(initializer: (configuration: MutableEvaluatorConfiguration, registries: Registries) => void): ImmutableCalcExpEvaluator {
        const configuration: MutableEvaluatorConfiguration = this.CONFIGURATION_DEFAULT;
        const registries = new Registries();
        initializer(configuration, registries);
        return new ImmutableCalcExpEvaluator(configuration, registries);
    }
}

export class CalcExpEvaluator extends ImmutableCalcExpEvaluator {
    public override readonly configuration: MutableEvaluatorConfiguration;

    public override readonly registries: Registries; 

    public constructor(config: MutableEvaluatorConfiguration = ImmutableCalcExpEvaluator.CONFIGURATION_DEFAULT) {
        const registries = new Registries();
        super(config, registries);
        this.configuration = config;
        this.registries = registries;
    }

    public override clone(): CalcExpEvaluator {
        const clone = new CalcExpEvaluator(this.configuration);
        this.registries.copyTo(clone.registries, true);
        return clone;
    }

    public static newDefaultEvaluator(): CalcExpEvaluator {
        const evaluator = new CalcExpEvaluator();

        // 四則演算 + 剰余 + 累乗
        const operators = evaluator.registries.get(RegistryKey.OPERATOR);
        const functions = evaluator.registries.get(RegistryKey.FUNCTION);
        const constants = evaluator.registries.get(RegistryKey.CONSTANT);

        operators.registerMultiple({
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
            }
        });

        /*evaluator.declare("!", CalcContextDeclarationCreator.SELF_OPERATOR_NUMBER_SUFFIX, x => {
            if (!Number.isInteger(x)) throw new TypeError("階乗演算子は実質的な整数の値にのみ使用できます");
            else if (x < 0) throw new TypeError("階乗演算子は負の値に使用できません");
            else if (x > 127) throw new TypeError("階乗演算子は127!を超えた値を計算できないよう制限されています");

            let result = 1;
            for (let i = 2; i <= x; i++) {
                result *= i;
            }

            return result;
        });*/

        // ビット演算
        evaluator.declare("&", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x & y;
        });
        evaluator.declare("|", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("|演算子は実質的な整数の値にのみ使用できます");
            return x | y;
        });
        evaluator.declare("^", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x ^ y;
        });
        evaluator.declare("<<", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if(!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x << y;
        });
        evaluator.declare(">>", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if(!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x >> y;
        });
        evaluator.declare(">>>", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if(!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x >>> y;
        });

        // 定数
        evaluator.declare("NaN", CalcContextDeclarationCreator.CONSTANT, NaN);
        evaluator.declare("PI", CalcContextDeclarationCreator.CONSTANT, Math.PI);
        evaluator.declare("TAU", CalcContextDeclarationCreator.CONSTANT, 2 * Math.PI);
        evaluator.declare("E", CalcContextDeclarationCreator.CONSTANT, Math.E);
        evaluator.declare("Infinity", CalcContextDeclarationCreator.CONSTANT, Infinity);

        // 引数0の関数
        functions.register("random", { argCount: FunctionArgCount.NO, call: Math.random });

        functions.register("sqrt", { argCount: FunctionArgCount.ONE, call: Math.sqrt });

        // 引数1の関数
        evaluator.declare("sqrt", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.sqrt);
        evaluator.declare("cbrt", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.cbrt);
        evaluator.declare("abs", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.abs);
        evaluator.declare("floor", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.floor);
        evaluator.declare("ceil", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.ceil);
        evaluator.declare("round", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.round);
        evaluator.declare("sin", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.sin);
        evaluator.declare("cos", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.cos);
        evaluator.declare("tan", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.tan);
        evaluator.declare("asin", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.asin);
        evaluator.declare("acos", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.acos);
        evaluator.declare("atan", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.atan);
        evaluator.declare("exp", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.exp);
        evaluator.declare("to_degrees", CalcContextDeclarationCreator.FUNCTION_1_ARG, radian => radian * 180 / Math.PI);
        evaluator.declare("to_radians", CalcContextDeclarationCreator.FUNCTION_1_ARG, degree => degree * Math.PI / 180);
        evaluator.declare("log10", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.log10);
        evaluator.declare("factorial", CalcContextDeclarationCreator.FUNCTION_1_ARG, value => {
            if (!Number.isInteger(value)) throw new TypeError("階乗は実質的な整数の値にのみ使用できます");
            else if (value < 0) throw new TypeError("階乗は負の値に使用できません");
            else if (value > 127) throw new TypeError("階乗は127!を超えた値を計算できないよう制限されています");

            let result = 1;
            for (let i = 2; i <= value; i++) {
                result *= i;
            }

            return result;
        });

        // 引数2の関数
        evaluator.declare("log", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.log);
        evaluator.declare("atan2", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.atan2);
        evaluator.declare("min", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.min);
        evaluator.declare("max", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.max);
        evaluator.declare("pow", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.pow);

        return evaluator;
    }
}
