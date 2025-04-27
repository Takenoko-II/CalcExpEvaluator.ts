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
    NUMBER_CHARS: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
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
        (cause === undefined) ? super(message) : super(message + "(cause: '" + String(cause) + "')", { cause });
    }
}

/**
 * {@link ImmutableDeclarationRegistry}から投げられるエラーのクラス
 */
export class RegistryError extends Error {
    public constructor(message: string, cause?: unknown) {
        (cause === undefined) ? super(message) : super(message + "(cause: '" + String(cause) + "')", { cause });
    }
}

export interface OptionalEvaluatorConfiguration {
    /**
     * `true` の場合, 計算結果が `NaN` になることを許容する    
     * デフォルトでは `false`
     */
    allowNaN?: boolean;

    /**
     * `true` の場合, 式中の大文字・小文字を区別する    
     * `false` の場合, 式中の大文字・小文字は区別されない    
     * たとえば `foo` 関数と `Foo` 関数が定義されていた場合, どちらが使用されるかはレジストリの気分次第    
     * デフォルトでは `true`
     */
    // caseSensitive: boolean;

    /**
     * `true` の場合, 計算中に例外が発生したとき `NaN` が返る    
     * ただし `allowNaN` が `false` の場合そちらが優先される
     * デフォルトでは `false`
     */
    neverThrows?: boolean;
}

interface ImmutableEvaluatorConfiguration extends OptionalEvaluatorConfiguration {
    readonly allowNaN: boolean;

    readonly neverThrows: boolean;
}

interface EvaluatorConfiguration extends ImmutableEvaluatorConfiguration {
    allowNaN: boolean;

    neverThrows: boolean;
}

export enum FunctionArgCount {
    /**
     * 引数なし
     */
    NO = "NO",

    /**
     * 引数1つ
     */
    ONE = "ONE",

    /**
     * 引数2つ
     */
    TWO = "TWO",

    /**
     * 可変長引数
     */
    VAR = "VAR"
}

export enum OperatorPriority {
    /**
     * 多項間演算用(ex: +, -)
     */
    POLYNOMIAL = "POLYNOMIAL",

    /**
     * 単項間演算用(ex: *, /)
     */
    MONOMIAL = "MONOMIAL",

    /**
     * 因数間演算用(ex: **)
     */
    FACTOR = "FACTOR"
}

type FunctionTypeLookup = {
    [FunctionArgCount.NO]: () => number;
    [FunctionArgCount.ONE]: (x: number) => number;
    [FunctionArgCount.TWO]: (x: number, y: number) => number;
    [FunctionArgCount.VAR]: (args: number[]) => number;
}

interface FunctionDeclarationInput<T extends FunctionArgCount> {
    /**
     * 関数の引数の数
     */
    readonly argCount: T;

    /**
     * 関数の実装
     */
    readonly call: FunctionTypeLookup[T];
}

interface OperatorDeclarationInput<T extends OperatorPriority> {
    /**
     * 演算子の実装
     * @param x 演算子の左側の値
     * @param y 演算子の右側の値
     */
    operate(x: number, y: number): number;

    /**
     * 演算子の優先順位
     */
    readonly priority: T;
}

interface ConstantDeclarationInput {
    /**
     * 値
     */
    readonly value: number;
}

type FunctionInputUnion<T = FunctionArgCount> = T extends FunctionArgCount ? FunctionDeclarationInput<T> : never;

type OperatorInputUnion<T = OperatorPriority> = T extends OperatorPriority ? OperatorDeclarationInput<T> : never;

/**
 * {@link ImmutableCalcExpEvaluator}の既存の定義を操作する際に使用する、定義カテゴリを表現するクラス
 */
abstract class Declaration<T> {
    protected constructor(protected readonly input: T) {}

    public static getInternalInput<U>(declaration: Declaration<U>): U {
        return { ...declaration.input };
    }
}

class FunctionDeclaration extends Declaration<FunctionInputUnion> {
    public readonly argCount: FunctionArgCount;

    public constructor(def: FunctionInputUnion) {
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

    private static isNoArg(def: FunctionInputUnion): def is FunctionDeclarationInput<FunctionArgCount.NO> {
        return def.argCount === FunctionArgCount.NO;
    }

    private static isOneArg(def: FunctionInputUnion): def is FunctionDeclarationInput<FunctionArgCount.ONE> {
        return def.argCount === FunctionArgCount.ONE;
    }

    private static isTwoArg(def: FunctionInputUnion): def is FunctionDeclarationInput<FunctionArgCount.TWO> {
        return def.argCount === FunctionArgCount.TWO;
    }

    private static isVarArg(def: FunctionInputUnion): def is FunctionDeclarationInput<FunctionArgCount.VAR> {
        return def.argCount === FunctionArgCount.VAR;
    }
}

class OperatorDeclaration extends Declaration<OperatorInputUnion> {
    public readonly priority: OperatorPriority;

    public constructor(def: OperatorInputUnion) {
        super(def);
        this.priority = def.priority;
    }

    public call(x: number, y: number): number {
        return this.input.operate(x, y);
    }
}

class ConstantDeclaration extends Declaration<ConstantDeclarationInput> {
    public readonly value: number;

    public constructor(def: ConstantDeclarationInput) {
        super(def);
        this.value = def.value;
    }
}

export class DeclarationRegistryKey<T, U extends Declaration<unknown>> {
    private static readonly keys: Set<DeclarationRegistryKey<unknown, Declaration<unknown>>> = new Set();

    private constructor(private readonly id: string) {
        DeclarationRegistryKey.keys.add(this);
    }

    /**
     * レジストリキーの文字列表現を返す関数
     * @returns 
     */
    public toString(): string {
        return "RegistryKey<" + this.id + ">";
    }

    /**
     * すべてのレジストリキーを返す関数
     * @returns `Set`
     */
    public static values(): ReadonlySet<DeclarationRegistryKey<unknown, Declaration<unknown>>> {
        return new Set(this.keys);
    }

    /**
     * 定数のレジストリキー
     */
    public static readonly CONSTANT = new this<ConstantDeclarationInput, ConstantDeclaration>("constant");

    /**
     * 関数のレジストリキー
     */
    public static readonly FUNCTION = new this<FunctionInputUnion, FunctionDeclaration>("function");

    /**
     * 演算子のレジストリキー
     */
    public static readonly OPERATOR = new this<OperatorInputUnion, OperatorDeclaration>("operator");
}

type DeclarationDescriptorMap<T> = Record<string, T>;

class ImmutableDeclarationRegistry<T, U extends Declaration<unknown>> {
    private readonly registry: Map<string, U> = new Map();

    /**
     * レジストリの参照に使用するオブジェクト
     */
    public readonly lookup: DeclarationRegistryLookup<U> = new DeclarationRegistryLookup(this.registry);

    public constructor(private readonly registryKey: DeclarationRegistryKey<T, U>, private readonly converter: (input: T) => U) {}

    /**
     * レジストリに宣言を登録する関数
     * @param name 宣言名
     * @param value 登録する値
     */
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

    /**
     * レジストリに複数の宣言を登録する関数
     * @param name 変数の接頭辞
     * @param values 複数の宣言
     */
    protected registerByDescriptor(values: DeclarationDescriptorMap<T>) {
        for (const name of Object.keys(values)) {
            this.register(name, values[name]);
        }
    }

    /**
     * レジストリに登録された宣言を削除する関数
     * @param name 宣言名
     */
    protected unregister(name: string): void {
        if (this.registry.has(name)) {
            this.registry.delete(name);
        }
        else {
            throw new RegistryError(`定義名 "${name}" が見つかりませんでした`);
        }
    }

    public writeTo(other: DeclarationRegistry<T, U>, overwrite: boolean): void {
        for (const { name, value } of this.lookup.getInNameLongestOrder()) {
            if (other.lookup.has(name)) {
                if (overwrite) other.unregister(name);
                else continue;
            }

            other.register(name, Declaration.getInternalInput(value) as T);
        }
    }
}

class DeclarationRegistry<T, U extends Declaration<unknown>> extends ImmutableDeclarationRegistry<T, U> {
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

interface DeclarationRegistryLookupResult<T extends Declaration<unknown>> {
    /**
     * 宣言名
     */
    readonly name: string;

    /**
     * 定義情報
     */
    readonly value: T;
}

class DeclarationRegistryLookup<T extends Declaration<unknown>> {
    public constructor(private readonly registry: Map<string, T>) {}

    /**
     * 指定の宣言名が存在するかを返す関数
     * @param name 宣言名
     * @returns 存在すれば `true`
     */
    public has(name: string): boolean {
        return this.registry.has(name);
    }

    /**
     * 宣言名から定義情報を返す関数
     * @param name 宣言名
     * @returns 定義情報
     * @throws 宣言名が見つからなかった場合
     */
    public findByOnlyName(name: string): T {
        if (this.registry.has(name)) {
            return this.registry.get(name)!;
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
    public find(name: string, condition: (value: T) => boolean): T {
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
    public getInNameLongestOrder(filter?: (value: T) => boolean): DeclarationRegistryLookupResult<T>[] {
        const list: ({ readonly name: string; readonly value: T })[] = [];

        for (const name of [...this.registry.keys()].sort((a, b) => b.length - a.length)) {
            const value = this.findByOnlyName(name);
            let result: DeclarationRegistryLookupResult<T>;

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

class ImmutableDeclarationRegistries {
    private readonly registries: Map<DeclarationRegistryKey<unknown, Declaration<unknown>>, DeclarationRegistry<unknown, Declaration<unknown>>> = new Map();

    protected constructor();

    protected constructor(registries: ImmutableDeclarationRegistries);

    protected constructor(registries?: ImmutableDeclarationRegistries) {
        const constantReg = this.create(DeclarationRegistryKey.CONSTANT, cons => new ConstantDeclaration(cons));
        const funcReg = this.create(DeclarationRegistryKey.FUNCTION, func => new FunctionDeclaration(func));
        const operatorReg = this.create(DeclarationRegistryKey.OPERATOR, oper => new OperatorDeclaration(oper));

        if (registries) {
            registries.get(DeclarationRegistryKey.CONSTANT).lookup.getInNameLongestOrder().forEach(val => {
                constantReg.register(val.name, Declaration.getInternalInput(val.value));
            });

            registries.get(DeclarationRegistryKey.FUNCTION).lookup.getInNameLongestOrder().forEach(val => {
                funcReg.register(val.name, Declaration.getInternalInput(val.value));
            });

            registries.get(DeclarationRegistryKey.OPERATOR).lookup.getInNameLongestOrder().forEach(val => {
                operatorReg.register(val.name, Declaration.getInternalInput(val.value));
            });
        }
    }

    private create<T, U extends Declaration<unknown>>(key: DeclarationRegistryKey<T, U>, converter: (input: T) => U): DeclarationRegistry<T, U> {
        if (!this.registries.has(key)) {
            const registry = new DeclarationRegistry(key, converter);
            this.registries.set(key, registry as DeclarationRegistry<unknown, Declaration<unknown>>);
            return registry;
        }
        else {
            throw new RegistryError(`既にレジストリ "${key.toString()}" は存在します`);
        }
    }

    /**
     * 指定のキーに対応するレジストリを返す関数
     * @param key レジストリキー
     * @returns 対応するレジストリ
     * @throws レジストリキーに対応するレジストリが見つからなかった場合
     */
    public get<T, U extends Declaration<unknown>>(key: DeclarationRegistryKey<T, U>): ImmutableDeclarationRegistry<T, U> {
        if (this.registries.has(key)) {
            return this.registries.get(key) as unknown as ImmutableDeclarationRegistry<T, U>;
        }
        else {
            throw new RegistryError(`レジストリ "${key.toString()}" が見つかりませんでした`);
        }
    }

    /**
     * 他のミュータブルインスタンスに自身と同じ情報を書き込む関数
     * @param other 他のインスタンス
     * @param overwrite `true` の場合, 渡されたインスタンスの状態を無視して定義を上書きする
     */
    public writeTo(other: DeclarationRegistries, overwrite: boolean): void {
        for (const [registryKey, registry] of this.registries) {
            registry.writeTo(other.get(registryKey), overwrite);
        }
    }
}

export class DeclarationRegistries extends ImmutableDeclarationRegistries {
    public constructor();

    public constructor(registries: ImmutableDeclarationRegistries);

    public constructor(registires?: ImmutableDeclarationRegistries) {
        if (registires) super(registires);
        else super();
    }

    public override get<T, U extends Declaration<unknown>>(key: DeclarationRegistryKey<T, U>): DeclarationRegistry<T, U> {
        return super.get(key) as DeclarationRegistry<T, U>;
    }

    /**
     * 読み取り専用のコピーを作成する関数
     * @returns 作成されたインスタンス
     */
    public toImmutable(): ImmutableDeclarationRegistries {
        return new ImmutableDeclarationRegistries(this);
    }

    /**
     * 基本的な演算子や定数・関数の定義が既に行われた読み取り専用レジストリ
     */
    public static readonly DEFAULT: ImmutableDeclarationRegistries = (() => {
        const registries = new DeclarationRegistries();

        registries.get(DeclarationRegistryKey.OPERATOR).registerByDescriptor({
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

        registries.get(DeclarationRegistryKey.CONSTANT).registerByDescriptor({
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

        registries.get(DeclarationRegistryKey.FUNCTION).registerByDescriptor({
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

        return registries.toImmutable();
    })();
}

export interface EvaluatorCreateOptions {
    /**
     * {@link ImmutableCalcExpEvaluator} の設定
     */
    configuration?: OptionalEvaluatorConfiguration;

    /**
     * 宣言のコピー元レジストリ    
     * 指定がない場合は空のレジストリが使用される
     */
    copySourceRegistries?: ImmutableDeclarationRegistries;
};

/**
 * 定義を外部から追加・変更・削除することができない{@link CalcExpEvaluator}のクラス
 */
export class ImmutableCalcExpEvaluator {
    private static readonly DEFAULT_CONFIGURATION: ImmutableEvaluatorConfiguration = {
        allowNaN: false,
        neverThrows: false
    };

    protected static mergeWithDefaultConfiguration(input?: OptionalEvaluatorConfiguration): EvaluatorConfiguration {
        return { ...this.DEFAULT_CONFIGURATION, ...input };
    }

    /**
     * 宣言のレジストリを纏めたオブジェクト
     */
    public readonly registries: ImmutableDeclarationRegistries;

    /**
     * このインスタンスの設定
     */
    public readonly configuration: ImmutableEvaluatorConfiguration;

    private expression: string = "";

    private location: number = 0;

    public constructor(options?: EvaluatorCreateOptions) {
        this.configuration = ImmutableCalcExpEvaluator.mergeWithDefaultConfiguration(options?.configuration);
        this.registries = options?.copySourceRegistries === undefined ? new DeclarationRegistries().toImmutable() : new DeclarationRegistries(options.copySourceRegistries).toImmutable();
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
            const operators = this.registries.get(DeclarationRegistryKey.OPERATOR).lookup.getInNameLongestOrder(v => v.priority === OperatorPriority.MONOMIAL);

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
            const operators = this.registries.get(DeclarationRegistryKey.OPERATOR).lookup.getInNameLongestOrder(v => v.priority === OperatorPriority.POLYNOMIAL);

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
            const operators = this.registries.get(DeclarationRegistryKey.OPERATOR).lookup.getInNameLongestOrder(v => v.priority === OperatorPriority.FACTOR);

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
        for (const constant of this.registries.get(DeclarationRegistryKey.CONSTANT).lookup.getInNameLongestOrder()) {
            if (this.test(constant.name)) {
                return true;
            }
        }

        return false;
    }

    private getConst(): ConstantDeclaration {
        for (const constant of this.registries.get(DeclarationRegistryKey.CONSTANT).lookup.getInNameLongestOrder()) {
            if (this.next(constant.name)) {
                return constant.value;
            }
        }

        throw new EvaluationError("定数を取得できませんでした");
    }

    private isFunction(): boolean {
        for (const func of this.registries.get(DeclarationRegistryKey.FUNCTION).lookup.getInNameLongestOrder()) {
            if (this.test(func.name, CHARACTER_DEFINITION.PARENTHESIS[0])) {
                return true;
            }
        }

        return false;
    }

    private getFunction(): FunctionDeclaration {
        for (const func of this.registries.get(DeclarationRegistryKey.FUNCTION).lookup.getInNameLongestOrder()) {
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
     * 引数に渡された文字列を式として評価する関数
     * @param expression 式
     * @returns 計算結果
     * @throws 文字列の解析に失敗するか、{@link ImmutableEvaluatorConfiguration#allowNaN}が `false` の状態で `NaN` が出力された場合
     */
    public evaluate(expression: string): number {
        this.expression = expression;

        const nanError = new EvaluationError("式からNaNが出力されました");;

        try {
            const value: number = this.index();

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
    public clone(): ImmutableCalcExpEvaluator {
        return new ImmutableCalcExpEvaluator({
            configuration: this.configuration,
            copySourceRegistries: this.registries
        });
    }
}

export class CalcExpEvaluator extends ImmutableCalcExpEvaluator {
    public override readonly configuration: EvaluatorConfiguration;

    public override readonly registries: DeclarationRegistries;

    public constructor(options?: EvaluatorCreateOptions) {
        super(options);
        this.configuration = ImmutableCalcExpEvaluator.mergeWithDefaultConfiguration(options?.configuration);
        this.registries = options?.copySourceRegistries === undefined ? new DeclarationRegistries() : new DeclarationRegistries(options.copySourceRegistries);
    }

    public override clone(): CalcExpEvaluator {
        return new CalcExpEvaluator({
            configuration: this.configuration,
            copySourceRegistries: this.registries
        });
    }
}
