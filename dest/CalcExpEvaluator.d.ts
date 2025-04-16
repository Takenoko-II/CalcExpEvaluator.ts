/**
 * {@link ImmutableCalcExpEvaluator#evaluate()}から投げられるエラーのクラス
 */
export declare class EvaluationError extends Error {
    constructor(message: string, cause?: unknown);
}
/**
 * {@link ImmutableRegistry}から投げられるエラーのクラス
 */
export declare class RegistryError extends Error {
    constructor(message: string, cause?: unknown);
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
export declare enum FunctionArgCount {
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
export declare enum OperatorPriority {
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
};
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
declare abstract class Declaration<T> {
    protected readonly input: T;
    protected constructor(input: T);
    static getInternalInput<U>(declaration: Declaration<U>): U;
}
declare class FunctionDeclaration extends Declaration<FunctionInputUnion> {
    readonly argCount: FunctionArgCount;
    constructor(def: FunctionInputUnion);
    call(args: number[]): number;
    private static isNoArg;
    private static isOneArg;
    private static isTwoArg;
    private static isVarArg;
}
declare class OperatorDeclaration extends Declaration<OperatorInputUnion> {
    readonly priority: OperatorPriority;
    constructor(def: OperatorInputUnion);
    call(x: number, y: number): number;
}
declare class ConstantDeclaration extends Declaration<ConstantDeclarationInput> {
    readonly value: number;
    constructor(def: ConstantDeclarationInput);
}
export declare class RegistryKey<T, U extends Declaration<unknown>> {
    private readonly id;
    private static readonly keys;
    private constructor();
    /**
     * レジストリキーの文字列表現を返す関数
     * @returns
     */
    toString(): string;
    /**
     * すべてのレジストリキーを返す関数
     * @returns `Set`
     */
    static values(): ReadonlySet<RegistryKey<unknown, Declaration<unknown>>>;
    /**
     * 定数のレジストリキー
     */
    static readonly CONSTANT: RegistryKey<ConstantDeclarationInput, ConstantDeclaration>;
    /**
     * 関数のレジストリキー
     */
    static readonly FUNCTION: RegistryKey<FunctionDeclarationInput<FunctionArgCount.NO> | FunctionDeclarationInput<FunctionArgCount.ONE> | FunctionDeclarationInput<FunctionArgCount.TWO> | FunctionDeclarationInput<FunctionArgCount.VAR>, FunctionDeclaration>;
    /**
     * 演算子のレジストリキー
     */
    static readonly OPERATOR: RegistryKey<OperatorDeclarationInput<OperatorPriority.POLYNOMIAL> | OperatorDeclarationInput<OperatorPriority.MONOMIAL> | OperatorDeclarationInput<OperatorPriority.FACTOR>, OperatorDeclaration>;
}
type DeclarationDescriptorMap<T> = Record<string, T>;
declare class ImmutableRegistry<T, U extends Declaration<unknown>> {
    private readonly registryKey;
    private readonly converter;
    private readonly registry;
    /**
     * レジストリの参照に使用するオブジェクト
     */
    readonly lookup: RegistryLookup<U>;
    constructor(registryKey: RegistryKey<T, U>, converter: (input: T) => U);
    /**
     * レジストリに宣言を登録する関数
     * @param name 宣言名
     * @param value 登録する値
     */
    protected register(name: string, value: T): void;
    /**
     * レジストリに複数の宣言を登録する関数
     * @param name 変数の接頭辞
     * @param values 複数の宣言
     */
    protected registerByDescriptor(values: DeclarationDescriptorMap<T>): void;
    /**
     * レジストリに登録された宣言を削除する関数
     * @param name 宣言名
     */
    protected unregister(name: string): void;
    writeTo(other: Registry<T, U>, overwrite: boolean): void;
}
declare class Registry<T, U extends Declaration<unknown>> extends ImmutableRegistry<T, U> {
    register(name: string, value: T): void;
    registerByDescriptor(values: DeclarationDescriptorMap<T>): void;
    unregister(name: string): void;
}
interface RegistryLookupResult<T extends Declaration<unknown>> {
    /**
     * 宣言名
     */
    readonly name: string;
    /**
     * 定義情報
     */
    readonly value: T;
}
declare class RegistryLookup<T extends Declaration<unknown>> {
    private readonly registry;
    constructor(registry: Map<string, T>);
    /**
     * 指定の宣言名が存在するかを返す関数
     * @param name 宣言名
     * @returns 存在すれば `true`
     */
    has(name: string): boolean;
    /**
     * 宣言名から定義情報を返す関数
     * @param name 宣言名
     * @returns 定義情報
     * @throws 宣言名が見つからなかった場合
     */
    findByOnlyName(name: string): T;
    /**
     * 宣言名と条件から定義情報を返す関数
     * @param name 宣言名
     * @param condition 条件
     * @returns 定義情報
     * @throws 宣言名が見つからなかった場合, 或いは条件を満たさなかった場合
     */
    find(name: string, condition: (value: T) => boolean): T;
    /**
     * 条件に一致するオブジェクト(宣言名と定義情報の双方を含む)を宣言名文字列の長い順で返す関数
     * @param filter 条件
     * @returns 宣言名と定義情報の双方を含むオブジェクトのソート済み配列
     */
    getInNameLongestOrder(filter?: (value: T) => boolean): RegistryLookupResult<T>[];
}
declare class ImmutableRegistries {
    private readonly registries;
    protected constructor();
    protected constructor(registries: ImmutableRegistries);
    private create;
    /**
     * 指定のキーに対応するレジストリを返す関数
     * @param key レジストリキー
     * @returns 対応するレジストリ
     * @throws レジストリキーに対応するレジストリが見つからなかった場合
     */
    get<T, U extends Declaration<unknown>>(key: RegistryKey<T, U>): ImmutableRegistry<T, U>;
    /**
     * 他のミュータブルインスタンスに自身と同じ情報を書き込む関数
     * @param other 他のインスタンス
     * @param overwrite `true` の場合, 渡されたインスタンスの状態を無視して定義を上書きする
     */
    writeTo(other: Registries, overwrite: boolean): void;
}
export declare class Registries extends ImmutableRegistries {
    constructor();
    constructor(registries: ImmutableRegistries);
    get<T, U extends Declaration<unknown>>(key: RegistryKey<T, U>): Registry<T, U>;
    /**
     * 読み取り専用のコピーを作成する関数
     * @returns 作成されたインスタンス
     */
    toImmutable(): ImmutableRegistries;
    /**
     * 基本的な演算子や定数・関数の定義が既に行われた読み取り専用レジストリ
     */
    static readonly DEFAULT: ImmutableRegistries;
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
    copySourceRegistries?: ImmutableRegistries;
}
/**
 * 定義を外部から追加・変更・削除することができない{@link CalcExpEvaluator}のクラス
 */
export declare class ImmutableCalcExpEvaluator {
    private static readonly DEFAULT_CONFIGURATION;
    protected static mergeWithDefaultConfiguration(input?: OptionalEvaluatorConfiguration): EvaluatorConfiguration;
    /**
     * 宣言のレジストリを纏めたオブジェクト
     */
    readonly registries: ImmutableRegistries;
    /**
     * このインスタンスの設定
     */
    readonly configuration: ImmutableEvaluatorConfiguration;
    private expression;
    private location;
    constructor(options?: EvaluatorCreateOptions);
    private isOver;
    private next;
    private back;
    private ignore;
    private test;
    private number;
    private applySign;
    private monomial;
    private polynomial;
    private operateWithAnotherFactor;
    private factor;
    private arguments;
    private isConst;
    private getConst;
    private isFunction;
    private getFunction;
    private index;
    /**
     * 引数に渡された文字列を式として評価する関数
     * @param expression 式
     * @returns 計算結果
     * @throws 文字列の解析に失敗するか、{@link ImmutableEvaluatorConfiguration#allowNaN}が `false` の状態で `NaN` が出力された場合
     */
    evaluate(expression: string): number;
    /**
     * 定義を全てコピーした新しいインスタンスを作成する関数
     * @returns このインスタンスの新しいクローン
     */
    clone(): ImmutableCalcExpEvaluator;
}
export declare class CalcExpEvaluator extends ImmutableCalcExpEvaluator {
    readonly configuration: EvaluatorConfiguration;
    readonly registries: Registries;
    constructor(options?: EvaluatorCreateOptions);
    clone(): CalcExpEvaluator;
}
export {};
