interface ImmutableConfiguration {
    readonly IGNORED: string[];

    readonly SIGNS: [string, string];

    readonly NUMBER_CHARS: string[];

    readonly NUMBER_PARSER: (input: string) => number;

    readonly DECIMAL_POINT: string;

    readonly COMMA: string;

    readonly PARENTHESIS: [string, string];
}

const immutableConfiguration: ImmutableConfiguration = {
    IGNORED: [' ', '\n'],
    SIGNS: ['+', '-'],
    NUMBER_CHARS: "0123456789".split(""),
    NUMBER_PARSER: (input: string) => {
        const value: number = Number.parseFloat(input);
        
        if (Number.isNaN(value)) {
            throw new CalcExpEvaluationError("数値の解析に失敗しました: '" + input + "'");
        }
        else {
            return value;
        }
    },
    DECIMAL_POINT: '.',
    COMMA: ',',
    PARENTHESIS: ['(', ')']
} as const;

export class CalcExpEvaluationError extends Error {
    public constructor(message: string, cause?: unknown) {
        (cause === undefined) ? super(message) : super(message, { cause });
    }
}

export class CalcContextDeclarationCategory<T> {
    private constructor() {}

    public static readonly CONSTANT: CalcContextDeclarationCategory<number> = new CalcContextDeclarationCategory();

    public static readonly FUNCTION: CalcContextDeclarationCategory<(args: number[]) => number> = new CalcContextDeclarationCategory();

    public static readonly OPERATOR: CalcContextDeclarationCategory<(x: number, y: number) => number> = new CalcContextDeclarationCategory();

    public static readonly SELF_OPERATOR: CalcContextDeclarationCategory<(x: number) => number> = new CalcContextDeclarationCategory();
}

export class CalcContextDeclarationCreator<T, U> {
    public readonly category: CalcContextDeclarationCategory<U>;

    private constructor(category: CalcContextDeclarationCategory<U>, modifier: (declarer: CalcContextDeclarationCreator<T, U>) => void) {
        this.category = category;
        modifier(this);
    }

    public constant(value: T): number {
        throw new TypeError("このインスタンスからは呼び出せません");
    }

    public function(value: T): (args: number[]) => number {
        throw new TypeError("このインスタンスからは呼び出せません");
    }

    public operator(value: T): (x: number, y: number) => number {
        throw new TypeError("このインスタンスからは呼び出せません");
    }

    public selfOperator(value: T): (x: number) => number {
        throw new TypeError("このインスタンスからは呼び出せません");
    }

    public static readonly CONSTANT: CalcContextDeclarationCreator<number, number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.CONSTANT,
        declarer => {
            declarer.constant = (value: number) => value;
        }
    );

    public static readonly FUNCTION_VARIABLE_LENGTH_ARGS: CalcContextDeclarationCreator<(args: number[]) => number, (args: number[]) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.FUNCTION,
        declarer => {
            declarer.function = (func: (args: number[]) => number) => {
                return func;
            }
        }
    );

    public static readonly FUNCTION_NO_ARGS: CalcContextDeclarationCreator<() => number, (args: number[]) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.FUNCTION,
        declarer => {
            declarer.function = (func: () => number) => (args) => {
                if (args.length !== 0) {
                    throw new TypeError("引数の数は0つが期待されています");
                }
                else {
                    return func();
                }
            }
        }
    );

    public static readonly FUNCTION_1_ARG: CalcContextDeclarationCreator<(x: number) => number, (args: number[]) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.FUNCTION,
        declarer => {
            declarer.function = (func: (x: number) => number) => (args) => {
                if (args.length !== 1) {
                    throw new TypeError("引数の数は1つが期待されています");
                }
                else {
                    return func(args[0]);
                }
            }
        }
    );

    public static readonly FUNCTION_2_ARGS: CalcContextDeclarationCreator<(x: number, y: number) => number, (args: number[]) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.FUNCTION,
        declarer => {
            declarer.function = (func: (x: number, y: number) => number) => (args) => {
                if (args.length !== 2) {
                    throw new TypeError("引数の数は2つが期待されています");
                }
                else {
                    return func(args[0], args[1]);
                }
            }
        }
    );

    public static readonly OPERATOR_POLYNOMIAL: CalcContextDeclarationCreator<(x: number, y: number) => number, (x: number, y: number) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.OPERATOR,
        declarer => {
            declarer.operator = (func: (x: number, y: number) => number) => func;
        }
    );

    public static readonly OPERATOR_MONOMIAL: CalcContextDeclarationCreator<(x: number, y: number) => number, (x: number, y: number) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.OPERATOR,
        declarer => {
            declarer.operator = (func: (x: number, y: number) => number) => func;
        }
    );

    public static readonly OPERATOR_FACTOR: CalcContextDeclarationCreator<(x: number, y: number) => number, (x: number, y: number) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.OPERATOR,
        declarer => {
            declarer.operator = (func: (x: number, y: number) => number) => func;
        }
    );

    public static readonly SELF_OPERATOR_NUMBER_SUFFIX: CalcContextDeclarationCreator<(x: number) => number, (x: number) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.SELF_OPERATOR,
        declarer => {
            declarer.selfOperator = (func: (x: number) => number) => func;
        }
    );
}

export class ImmutableCalcExpEvaluator {
    protected readonly MONOMIAL_OPERATORS: Map<string, (x: number, y: number) => number> = new Map();

    protected readonly POLYNOMIAL_OPERATORS: Map<string, (x: number, y: number) => number> = new Map();

    protected readonly FACTOR_OPERATORS: Map<string, (x: number, y: number) => number> = new Map();

    protected readonly NUMBER_SUFFIX_OPERATORS: Map<string, (x: number) => number> = new Map();

    protected readonly FUNCTIONS: Map<string, (args: number[]) => number> = new Map();

    protected readonly CONSTANTS: Map<string, number> = new Map();

    private expression: string = "";

    private location: number = 0;

    protected constructor() {}

    private isOver(): boolean {
        return this.location >= this.expression.length
    }

    private next(): string;

    private next(next: string): string;

    private next(next?: string): string | boolean {
        if (next === undefined) {
            if (this.isOver()) {
                throw new CalcExpEvaluationError("文字数を超えた位置へのアクセスが発生しました");
            }

            const current: string = this.expression.charAt(this.location++);
    
            if (immutableConfiguration.IGNORED.includes(current)) return this.next();
    
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

        if (immutableConfiguration.IGNORED.includes(current)) {
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

        for (const signChar of immutableConfiguration.SIGNS) {
            if (this.next(signChar)) {
                string += signChar;
                break;
            }
        }

        if (this.isFunction()) {
            try {
                string += this.getFunction()(this.arguments());
            }
            catch (e) {
                throw new CalcExpEvaluationError("関数が例外を投げました", e);
            }
        }
        else if (this.isConst()) {
            string += this.getConst();
        }
        else if (immutableConfiguration.SIGNS.some(sign => this.test(sign)) || this.test(immutableConfiguration.PARENTHESIS[0])) {
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
                const current: string = this.next();

                if (immutableConfiguration.NUMBER_CHARS.includes(current)) {
                    string += current;
                }
                else if (current == immutableConfiguration.DECIMAL_POINT) {
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

        return immutableConfiguration.NUMBER_PARSER(string);
    }

    private applySign(value: number, sign: string): number {
        if (immutableConfiguration.SIGNS[0] === sign) {
            return value;
        }
        else if (immutableConfiguration.SIGNS[1] === sign) {
            return -value;
        }
        else {
            throw new CalcExpEvaluationError("'" + sign + "'は無効な符号です");
        }
    }

    private sortIteratorInLongestOrder(mapIterator: IterableIterator<string>): string[] {
        return [...mapIterator].sort((a, b) => b.length - a.length);
    }

    private monomial(): number {
        let value: number = this.factorOperator(this.factor());

        a: while (!this.isOver()) {
            for (const operatorName of this.sortIteratorInLongestOrder(this.MONOMIAL_OPERATORS.keys())) {
                if (this.next(operatorName)) {
                    const operator = this.MONOMIAL_OPERATORS.get(operatorName);

                    if (operator === undefined) {
                        throw new CalcExpEvaluationError("NEVER HAPPENS");
                    }

                    try {
                        value = operator(value, this.factorOperator(this.factor()));
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
            for (const operatorName of this.sortIteratorInLongestOrder(this.POLYNOMIAL_OPERATORS.keys())) {
                if (this.next(operatorName)) {
                    const operator = this.POLYNOMIAL_OPERATORS.get(operatorName);

                    if (operator === undefined) {
                        throw new CalcExpEvaluationError("NEVER HAPPENS");
                    }

                    try {
                        value = operator(value, this.monomial());
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

    private factorOperator(num: number): number {
        let value: number = num;

        a: while (!this.isOver()) {
            for (const operatorName of this.sortIteratorInLongestOrder(this.NUMBER_SUFFIX_OPERATORS.keys())) {
                if (this.next(operatorName)) {
                    const operator = this.NUMBER_SUFFIX_OPERATORS.get(operatorName);

                    if (operator === undefined) {
                        throw new CalcExpEvaluationError("NEVER HAPPENS");
                    }

                    try {
                        value = operator(value);
                    }
                    catch (e) {
                        throw new CalcExpEvaluationError("接尾辞演算子が例外を投げました", e)
                    }
                    continue a;
                }
            }

            for (const operatorName of this.sortIteratorInLongestOrder(this.FACTOR_OPERATORS.keys())) {
                if (this.next(operatorName)) {
                    const operator = this.FACTOR_OPERATORS.get(operatorName);

                    if (operator === undefined) {
                        throw new CalcExpEvaluationError("NEVER HAPPENS");
                    }

                    const obj: number = this.factor();

                    try {
                        value = operator(value, obj);
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

        if (current == immutableConfiguration.PARENTHESIS[0]) {
            let value: number = this.polynomial();

            if (this.isOver()) {
                throw new CalcExpEvaluationError("括弧が閉じられていません");
            }

            const next: string = this.next();

            if (next == immutableConfiguration.PARENTHESIS[1]) {
                this.ignore();
                return value;
            }
            else {
                throw new CalcExpEvaluationError("括弧が閉じられていません: " + next);
            }
        }
        else {
            this.back();

            let num: number = this.number();

            if (Number.isNaN(num)) {
                throw new CalcExpEvaluationError("因数の解析中に関数または定数からのNaNの出力を検出しました");
            }
            return num;
        }
    }

    private arguments(): number[] {
        const args: number[] = [];

        if (!this.next(immutableConfiguration.PARENTHESIS[0])) {
            throw new CalcExpEvaluationError("関数の呼び出しには括弧が必要です");
        }

        if (this.next(immutableConfiguration.PARENTHESIS[1])) {
            return args;
        }

        while (true) {
            if (this.isOver()) {
                throw new CalcExpEvaluationError("引数の探索中に文字列外に来ました");
            }

            let value: number = this.polynomial();
            const next: string = this.next();

            if (next == immutableConfiguration.COMMA) {
                args.push(value);
            }
            else if (next == immutableConfiguration.PARENTHESIS[1]) {
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
        for (const name of this.sortIteratorInLongestOrder(this.CONSTANTS.keys())) {
            if (this.test(name)) {
                return true;
            }
        }

        return false;
    }

    private getConst(): number {
        for (const name of this.sortIteratorInLongestOrder(this.CONSTANTS.keys())) {
            if (this.next(name)) {
                const value = this.CONSTANTS.get(name);

                if (value === undefined) {
                    throw new CalcExpEvaluationError("NEVER HAPPENS");
                }

                return value;
            }
        }

        throw new CalcExpEvaluationError("定数を取得できませんでした");
    }

    private isFunction(): boolean {
        for (const name of this.sortIteratorInLongestOrder(this.FUNCTIONS.keys())) {
            if (this.test(name, immutableConfiguration.PARENTHESIS[0])) {
                return true;
            }
        }

        return false;
    }

    private getFunction(): (args: number[]) => number {
        for (const name of this.sortIteratorInLongestOrder(this.FUNCTIONS.keys())) {
            if (this.test(name, immutableConfiguration.PARENTHESIS[0])) {
                const value = this.FUNCTIONS.get(name);

                this.next(name);

                if (value === undefined) {
                    throw new CalcExpEvaluationError("NEVER HAPPENS");
                }
                else {
                    return value;
                }
            }
        }

        throw new CalcExpEvaluationError("関数を取得できませんでした");
    }

    private index(): number {
        if (this.location != 0) {
            this.location = 0;
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

    public evaluate(expression: string): number {
        this.expression = expression;

        const value: number = this.index();

        if (Number.isNaN(value)) {
            throw new CalcExpEvaluationError("式からNaNが出力されました");
        }

        this.location = 0;
        this.expression = "";

        return value;
    }

    public isDeclared<T>(name: string, category: CalcContextDeclarationCategory<T>): boolean {
        switch (category) {
            case CalcContextDeclarationCategory.CONSTANT:
                return this.CONSTANTS.has(name);
            case CalcContextDeclarationCategory.FUNCTION:
                return this.FUNCTIONS.has(name);
            case CalcContextDeclarationCategory.OPERATOR:
                return this.POLYNOMIAL_OPERATORS.has(name)
                    || this.MONOMIAL_OPERATORS.has(name)
                    || this.FACTOR_OPERATORS.has(name);
            case CalcContextDeclarationCategory.SELF_OPERATOR:
                return this.NUMBER_SUFFIX_OPERATORS.has(name);
            default:
                throw new TypeError("無効なCategoryインスタンスです");
        }
    }

    public getContextOf<T>(category: CalcContextDeclarationCategory<T>): Set<string> {
        switch (category) {
            case CalcContextDeclarationCategory.CONSTANT:
                return new Set(this.CONSTANTS.keys());
            case CalcContextDeclarationCategory.FUNCTION:
                return new Set(this.FUNCTIONS.keys());
            case CalcContextDeclarationCategory.OPERATOR: {
                const set: Set<string> = new Set();

                for (const polynomial of this.POLYNOMIAL_OPERATORS.keys()) {
                    set.add(polynomial);
                }

                for (const monomial of this.MONOMIAL_OPERATORS.keys()) {
                    set.add(monomial);
                }

                for (const factor of this.FACTOR_OPERATORS.keys()) {
                    set.add(factor);
                }

                return set;
            }
            case CalcContextDeclarationCategory.SELF_OPERATOR:
                return new Set(this.NUMBER_SUFFIX_OPERATORS.keys());
            default:
                throw new TypeError("無効なCategoryインスタンスです");
        };
    }

    protected declare<T, U>(name: string, declarer: CalcContextDeclarationCreator<T, U>, value: T): void {
        if (name.includes(immutableConfiguration.PARENTHESIS[0])
            || name.includes(immutableConfiguration.PARENTHESIS[1])
            || name.includes(immutableConfiguration.COMMA)
        ) {
            throw new TypeError(
                `定義名に無効な文字(${immutableConfiguration.PARENTHESIS[0]}, ${immutableConfiguration.PARENTHESIS[1]}, ${immutableConfiguration.COMMA})が含まれています`
            );
        }

        switch (declarer.category) {
            case CalcContextDeclarationCategory.CONSTANT:
                this.CONSTANTS.set(name, declarer.constant(value));
                break;
            case CalcContextDeclarationCategory.FUNCTION:
                this.FUNCTIONS.set(name, declarer.function(value));
                break;
            case CalcContextDeclarationCategory.OPERATOR: {
                switch (declarer) {
                    case CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL:
                        this.POLYNOMIAL_OPERATORS.set(name, declarer.operator(value));
                        break;
                    case CalcContextDeclarationCreator.OPERATOR_MONOMIAL:
                        this.MONOMIAL_OPERATORS.set(name, declarer.operator(value));
                        break;
                    case CalcContextDeclarationCreator.OPERATOR_FACTOR:
                        this.FACTOR_OPERATORS.set(name, declarer.operator(value));
                        break;
                    default:
                        throw new TypeError("無効なDeclarerインスタンスです");
                }
                break;
            }
            case CalcContextDeclarationCategory.SELF_OPERATOR:
                this.NUMBER_SUFFIX_OPERATORS.set(name, declarer.selfOperator(value));
                break;
            default:
                throw new TypeError("無効なCategoryインスタンスです");
        }
    }

    protected undeclare<T>(name: string, category: CalcContextDeclarationCategory<T>): void {
        if (!this.isDeclared(name, category)) {
            throw new TypeError("定義が見つかりません");
        }

        switch (category) {
            case CalcContextDeclarationCategory.CONSTANT:
                this.CONSTANTS.delete(name);
                break;
            case CalcContextDeclarationCategory.FUNCTION:
                this.FUNCTIONS.delete(name);
                break;
            case CalcContextDeclarationCategory.OPERATOR:
                this.POLYNOMIAL_OPERATORS.delete(name);
                this.MONOMIAL_OPERATORS.delete(name);
                this.FACTOR_OPERATORS.delete(name);
                break;
            case CalcContextDeclarationCategory.SELF_OPERATOR:
                this.NUMBER_SUFFIX_OPERATORS.delete(name);
                break;
            default:
                throw new TypeError("無効なCategoryインスタンスです");
        }
    }

    public clone(): ImmutableCalcExpEvaluator {
        const clone = new CalcExpEvaluator();
        
        for (const constant of this.CONSTANTS) {
            clone.declare(constant[0], CalcContextDeclarationCreator.CONSTANT, constant[1]);
        }

        for (const func of this.FUNCTIONS) {
            clone.declare(func[0], CalcContextDeclarationCreator.FUNCTION_VARIABLE_LENGTH_ARGS, func[1]);
        }

        for (const operator of this.POLYNOMIAL_OPERATORS) {
            clone.declare(operator[0], CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, operator[1]);
        }

        for (const operator of this.MONOMIAL_OPERATORS) {
            clone.declare(operator[0], CalcContextDeclarationCreator.OPERATOR_MONOMIAL, operator[1]);
        }

        for (const operator of this.FACTOR_OPERATORS) {
            clone.declare(operator[0], CalcContextDeclarationCreator.OPERATOR_FACTOR, operator[1]);
        }

        for (const operator of this.NUMBER_SUFFIX_OPERATORS) {
            clone.declare(operator[0], CalcContextDeclarationCreator.SELF_OPERATOR_NUMBER_SUFFIX, operator[1]);
        }

        return clone;
    }
}

export class CalcExpEvaluator extends ImmutableCalcExpEvaluator {
    public constructor() {
        super();
    }

    public override declare<T, U>(name: string, declarer: CalcContextDeclarationCreator<T, U>, value: T): void {
        super.declare(name, declarer, value);
    }

    public override undeclare<T>(name: string, category: CalcContextDeclarationCategory<T>): void {
        super.undeclare(name, category);
    }

    public override clone(): CalcExpEvaluator {
        return super.clone() as CalcExpEvaluator;
    }

    public static newDefaultEvaluator(): CalcExpEvaluator {
        const evaluator = new CalcExpEvaluator();

        // 四則演算 + 剰余 + 累乗 + 階乗
        evaluator.declare("+", CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, (x, y) => x + y);
        evaluator.declare("-", CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, (x, y) => x - y);
        evaluator.declare("*", CalcContextDeclarationCreator.OPERATOR_MONOMIAL, (x, y) => x * y);
        evaluator.declare("/", CalcContextDeclarationCreator.OPERATOR_MONOMIAL, (x, y) => x / y);
        evaluator.declare("%", CalcContextDeclarationCreator.OPERATOR_MONOMIAL, (x, y) => x % y);
        evaluator.declare("**", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => x ** y);
        evaluator.declare("!", CalcContextDeclarationCreator.SELF_OPERATOR_NUMBER_SUFFIX, x => {
            if (!Number.isInteger(x)) throw new TypeError("階乗演算子は実質的な整数の値にのみ使用できます");
            else if (x < 0) throw new TypeError("階乗演算子は負の値に使用できません");
            else if (x > 127) throw new TypeError("階乗演算子は127!を超えた値を計算できないよう制限されています");

            let result = 1;
            for (let i = 2; i <= x; i++) {
                result *= i;
            }

            return result;
        });

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
        evaluator.declare("random", CalcContextDeclarationCreator.FUNCTION_NO_ARGS, Math.random);

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

        // 引数2の関数
        evaluator.declare("log", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.log);
        evaluator.declare("atan2", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.atan2);
        evaluator.declare("min", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.min);
        evaluator.declare("max", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.max);
        evaluator.declare("pow", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.pow);

        return evaluator;
    }
}
