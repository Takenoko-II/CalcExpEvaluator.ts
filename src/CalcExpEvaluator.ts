interface CharacterDefinition {
    readonly IGNORED: readonly string[];

    readonly SIGNS: readonly [string, string];

    readonly NUMBER_CHARS: readonly string[];

    readonly NUMBER_PARSER: (input: string) => number;

    readonly DECIMAL_POINT: string;

    readonly COMMA: string;

    readonly PARENTHESIS: readonly [string, string];

    readonly UNDECLARABLE_CHARS: readonly string[];
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
    public constructor(message: string, cause?: unknown) {
        (cause === undefined) ? super(message) : super(message, { cause });
    }
}

/**
 * {@link ImmutableCalcExpEvaluator#evaluate()}から投げられるエラーのクラス
 */
export class RegistryError extends Error {
    public constructor(message: string, cause?: unknown) {
        (cause === undefined) ? super(message) : super(message, { cause });
    }
}

interface ImmutableEvaluatorConfiguration {
    /**
     * 真の場合、計算結果が`NaN`になることを許容します    
     * デフォルトでは`false`です
     */
    readonly allowNaN: boolean;
}

export interface EvaluatorConfiguration extends ImmutableEvaluatorConfiguration {
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
abstract class Declaration<T> {
    protected constructor(protected readonly input: T) {}

    public static getInternalInput<T>(declaration: Declaration<T>): T {
        return { ...declaration.input };
    }
}

class FunctionDeclaration extends Declaration<FunctionDefUnion> {
    public readonly argCount: FunctionArgCount;

    public constructor(def: FunctionDefUnion) {
        super(def);
        this.argCount = def.argCount;
    }

    public call(args: number[]): number {
        if (FunctionDeclaration.isNoArg(this.input)) {
            if (args.length === 0) return this.input.call();
            else throw new TypeError(`関数に渡された引数の数が正しくありません: 正=0, 誤=${args.length}`);
        }
        else if (FunctionDeclaration.isOneArg(this.input)) {
            if (args.length === 1) return this.input.call(args[0]);
            else throw new TypeError(`関数に渡された引数の数が正しくありません: 正=1, 誤=${args.length}`);
        }
        else if (FunctionDeclaration.isTwoArg(this.input)) {
            if (args.length === 2) return this.input.call(args[0], args[1]);
            else throw new TypeError(`関数に渡された引数の数が正しくありません: 正=2, 誤=${args.length}`);
        }
        else if (FunctionDeclaration.isVarArg(this.input)) {
            return this.input.call(args);
        }
        else {
            throw new Error("NEVER HAPPENS");
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

class OperatorDeclaration extends Declaration<OperatorDefUnion> {
    public readonly priority: OperatorPriority;

    public constructor(def: OperatorDefUnion) {
        super(def);
        this.priority = def.priority;
    }

    public call(x: number, y: number): number {
        return this.input.operate(x, y);
    }
}

class ConstantDeclaration extends Declaration<number> {
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

type DeclarationDescriptorMap<T> = Record<string, T>;

class ImmutableRegistry<T, U> {
    private readonly registry: Map<string, U> = new Map();

    public readonly lookup: RegistryLookup<U> = new RegistryLookup(this.registry);

    public constructor(private readonly registryKey: RegistryKey<T, U>, private readonly converter: (input: T) => U) {}

    protected register(name: string, value: T): void {
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

    protected registerByDescriptor(values: DeclarationDescriptorMap<T>) {
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
            throw new RegistryError(`定義名 "${name}" が見つかりませんでした`);
        }
    }
}

class Registry<T, U> extends ImmutableRegistry<T, U> {
    public override register(name: string, value: T): void {
        super.register(name, value);
    }

    public override registerByDescriptor(values: DeclarationDescriptorMap<T>): void {
        super.registerByDescriptor(values);
    }

    public override unregister(name: string): void {
        super.unregister(name);
    }
}

interface RegistryLookupResult<T> {
    readonly name: string;
    readonly value: T;
}

class RegistryLookup<T> {
    public constructor(private readonly registry: Map<string, T>) {}

    public has(name: string): boolean {
        return this.registry.has(name);
    }

    public getAll(): ReadonlySet<string> {
        return new Set(this.registry.keys());
    }

    public findByOnlyName(name: string): T {
        if (this.registry.has(name)) {
            return this.registry.get(name)!;
        }
        else {
            throw new RegistryError(`定義名 "${name}" が見つかりませんでした`);
        }
    }

    public find(name: string, condition: (value: T) => boolean): T {
        const value = this.findByOnlyName(name);

        if (condition(value)) {
            return value;
        }
        else {
            throw new RegistryError(`定義名 "${name}" は存在しますが、渡された条件に一致しません`);
        }
    }

    public getInLongestOrder(filter?: (value: T) => boolean): RegistryLookupResult<T>[] {
        const list: ({ readonly name: string; readonly value: T })[] = [];

        for (const name of [...this.registry.keys()].sort((a, b) => b.length - a.length)) {
            const value = this.findByOnlyName(name);
            let result: RegistryLookupResult<T>;

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
    private readonly registries: Map<RegistryKey<unknown, unknown>, Registry<unknown, unknown>> = new Map();

    public constructor();

    public constructor(registries: Registries);

    public constructor(registries?: Registries) {
        const constantReg = this.create(RegistryKey.CONSTANT, number => new ConstantDeclaration(number));
        const funcReg = this.create(RegistryKey.FUNCTION, func => new FunctionDeclaration(func));
        const operatorReg = this.create(RegistryKey.OPERATOR, oper => new OperatorDeclaration(oper));

        if (registries) {
            registries.get(RegistryKey.CONSTANT).lookup.getInLongestOrder().forEach(val => {
                constantReg.register(val.name, Declaration.getInternalInput(val.value));
            });

            registries.get(RegistryKey.FUNCTION).lookup.getInLongestOrder().forEach(val => {
                funcReg.register(val.name, Declaration.getInternalInput(val.value));
            });

            registries.get(RegistryKey.OPERATOR).lookup.getInLongestOrder().forEach(val => {
                operatorReg.register(val.name, Declaration.getInternalInput(val.value));
            });
        }
    }

    private create<T, U>(key: RegistryKey<T, U>, converter: (input: T) => U): Registry<T, U> {
        if (!this.registries.has(key)) {
            const registry = new Registry(key, converter);
            this.registries.set(key, registry as Registry<unknown, unknown>);
            return registry;
        }
        else {
            throw new RegistryError(`既にレジストリ "${key.id}" は存在します`);
        }
    }

    public get<T, U>(key: RegistryKey<T, U>): ImmutableRegistry<T, U> {
        if (this.registries.has(key)) {
            return this.registries.get(key) as ImmutableRegistry<T, U>;
        }
        else {
            throw new RegistryError(`レジストリ "${key.id}" が見つかりませんでした`);
        }
    }

    public copyTo(other: Registries, overwrite: boolean): void {
        for (const [registryKey, registry] of this.registries) {
            for (const name of registry.lookup.getAll()) {
                const otherRegistry = other.get(registryKey);
                if (otherRegistry.lookup.has(name) && overwrite) {
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

export class Registries extends ImmutableRegistries {
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
                throw new EvaluationError("文字数を超えた位置へのアクセスが発生しました");
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

    private applySign(value: number, sign: string): number {
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
                        throw new EvaluationError("単項間演算子が例外を投げました", e)
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
                        throw new EvaluationError("多項間演算子が例外を投げました", e);
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
                        throw new EvaluationError("因数間演算子が例外を投げました", e);
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
                throw new EvaluationError("括弧が閉じられていません");
            }

            const next: string = this.next();

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

    private arguments(): number[] {
        const args: number[] = [];

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
                throw new EvaluationError("関数の引数の区切りが見つかりません: " + next);
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

        throw new EvaluationError("定数を取得できませんでした");
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

        throw new EvaluationError("関数を取得できませんでした");
    }

    private index(): number {
        if (this.location != 0) {
            throw new EvaluationError("カーソル位置が0ではありませんでした インスタンス自身がevaluate()を呼び出した可能性があります");
        }

        if (this.isOver()) {
            throw new EvaluationError("空文字は計算できません");
        }

        const value: number = this.polynomial();

        if (this.expression.substring(this.location).length !== 0) {
            throw new EvaluationError("式の終了後に無効な文字を検出しました");
        }

        return value;
    }

    /**
     * 引数に渡された文字列を式として評価します
     * @param expression 式
     * @returns 計算結果
     * @throws 文字列の解析に失敗するか、{@link ImmutableEvaluatorConfiguration#allowNaN}が`false`の状態で`NaN`が出力された際に{@link EvaluationError}をthrowします
     */
    public evaluate(expression: string): number {
        this.expression = expression;

        try {
            const value: number = this.index();

            if (Number.isNaN(value) && !this.configuration.allowNaN) {
                throw new EvaluationError("式からNaNが出力されました");
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
        const clone = new ImmutableCalcExpEvaluator(this.configuration, new ImmutableRegistries(newRegistries));
        return clone;
    }

    /**
     * 定義を外部から追加・変更・削除することができない{@link CalcExpEvaluator}のインスタンスを作成します
     * @param initializer 初期化子
     * @returns 新しい{@link ImmutableCalcExpEvaluator}のインスタンス
     */
    public static newImmutableEvaluator(initializer: (configuration: EvaluatorConfiguration, registries: Registries) => void): ImmutableCalcExpEvaluator {
        const configuration: EvaluatorConfiguration = this.CONFIGURATION_DEFAULT;
        const registries = new Registries();
        initializer(configuration, registries);
        return new ImmutableCalcExpEvaluator(configuration, new ImmutableRegistries(registries));
    }
}

export class CalcExpEvaluator extends ImmutableCalcExpEvaluator {
    public override readonly configuration: EvaluatorConfiguration;

    public override readonly registries: Registries; 

    public constructor(config: EvaluatorConfiguration = ImmutableCalcExpEvaluator.CONFIGURATION_DEFAULT) {
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

        const operators = evaluator.registries.get(RegistryKey.OPERATOR);
        const functions = evaluator.registries.get(RegistryKey.FUNCTION);
        const constants = evaluator.registries.get(RegistryKey.CONSTANT);

        operators.registerByDescriptor({
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
                    if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x & y;
                }
            },
            "|": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x | y;
                }
            },
            "^": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x ^ y;
                }
            },
            "<<": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x << y;
                }
            },
            ">>": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x >> y;
                }
            },
            ">>>": {
                priority: OperatorPriority.FACTOR,
                operate(x, y) {
                    if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
                    return x >>> y;
                }
            }
        });

        constants.registerByDescriptor({
            "NaN": NaN,
            "PI": Math.PI,
            "TAU": Math.PI * 2,
            "E": Math.E,
            "Infinity": Infinity
        });

        functions.registerByDescriptor({
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
                    if (!Number.isInteger(x)) throw new TypeError("階乗は実質的な整数の値にのみ使用できます");
                    else if (x < 0) throw new TypeError("階乗は負の値に使用できません");
                    else if (x > 127) throw new TypeError("階乗は負荷軽減のため、127!を超えた値を計算できないよう制限されています");
        
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

        return evaluator;
    }
}
