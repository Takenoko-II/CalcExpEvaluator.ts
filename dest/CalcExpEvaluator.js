const immutableConfiguration = {
    IGNORED: [' ', '\n'],
    SIGNS: ['+', '-'],
    NUMBER_CHARS: "0123456789".split(""),
    NUMBER_PARSER: (input) => {
        const value = Number.parseFloat(input);
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
};
export class CalcExpEvaluationError extends Error {
    constructor(message, cause) {
        (cause === undefined) ? super(message) : super(message, { cause });
    }
}
export class CalcContextDeclarationCategory {
    constructor() { }
    static CONSTANT = new CalcContextDeclarationCategory();
    static FUNCTION = new CalcContextDeclarationCategory();
    static OPERATOR = new CalcContextDeclarationCategory();
    static SELF_OPERATOR = new CalcContextDeclarationCategory();
}
export class CalcContextDeclarationCreator {
    category;
    constructor(category, modifier) {
        this.category = category;
        modifier(this);
    }
    constant(value) {
        throw new TypeError("このインスタンスからは呼び出せません");
    }
    function(value) {
        throw new TypeError("このインスタンスからは呼び出せません");
    }
    operator(value) {
        throw new TypeError("このインスタンスからは呼び出せません");
    }
    selfOperator(value) {
        throw new TypeError("このインスタンスからは呼び出せません");
    }
    static CONSTANT = new CalcContextDeclarationCreator(CalcContextDeclarationCategory.CONSTANT, declarer => {
        declarer.constant = (value) => value;
    });
    static FUNCTION_VARIABLE_LENGTH_ARGS = new CalcContextDeclarationCreator(CalcContextDeclarationCategory.FUNCTION, declarer => {
        declarer.function = (func) => {
            return func;
        };
    });
    static FUNCTION_NO_ARGS = new CalcContextDeclarationCreator(CalcContextDeclarationCategory.FUNCTION, declarer => {
        declarer.function = (func) => (args) => {
            if (args.length !== 0) {
                throw new TypeError("引数の数は0つが期待されています");
            }
            else {
                return func();
            }
        };
    });
    static FUNCTION_1_ARG = new CalcContextDeclarationCreator(CalcContextDeclarationCategory.FUNCTION, declarer => {
        declarer.function = (func) => (args) => {
            if (args.length !== 1) {
                throw new TypeError("引数の数は1つが期待されています");
            }
            else {
                return func(args[0]);
            }
        };
    });
    static FUNCTION_2_ARGS = new CalcContextDeclarationCreator(CalcContextDeclarationCategory.FUNCTION, declarer => {
        declarer.function = (func) => (args) => {
            if (args.length !== 2) {
                throw new TypeError("引数の数は2つが期待されています");
            }
            else {
                return func(args[0], args[1]);
            }
        };
    });
    static OPERATOR_POLYNOMIAL = new CalcContextDeclarationCreator(CalcContextDeclarationCategory.OPERATOR, declarer => {
        declarer.operator = (func) => func;
    });
    static OPERATOR_MONOMIAL = new CalcContextDeclarationCreator(CalcContextDeclarationCategory.OPERATOR, declarer => {
        declarer.operator = (func) => func;
    });
    static OPERATOR_FACTOR = new CalcContextDeclarationCreator(CalcContextDeclarationCategory.OPERATOR, declarer => {
        declarer.operator = (func) => func;
    });
    static SELF_OPERATOR_NUMBER_SUFFIX = new CalcContextDeclarationCreator(CalcContextDeclarationCategory.SELF_OPERATOR, declarer => {
        declarer.selfOperator = (func) => func;
    });
}
export class ImmutableCalcExpEvaluator {
    MONOMIAL_OPERATORS = new Map();
    POLYNOMIAL_OPERATORS = new Map();
    FACTOR_OPERATORS = new Map();
    NUMBER_SUFFIX_OPERATORS = new Map();
    FUNCTIONS = new Map();
    CONSTANTS = new Map();
    expression = "";
    location = 0;
    constructor() { }
    isOver() {
        return this.location >= this.expression.length;
    }
    next(next = true) {
        if (typeof next === "boolean") {
            if (this.isOver()) {
                throw new CalcExpEvaluationError("文字数を超えた位置へのアクセスが発生しました");
            }
            const current = this.expression.charAt(this.location++);
            if (immutableConfiguration.IGNORED.includes(current) && next)
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
        if (immutableConfiguration.IGNORED.includes(current)) {
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
    applySign(value, sign) {
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
    sortIteratorInLongestOrder(mapIterator) {
        return [...mapIterator].sort((a, b) => b.length - a.length);
    }
    monomial() {
        let value = this.factorOperator(this.factor());
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
                        throw new CalcExpEvaluationError("単項間演算子が例外を投げました", e);
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
    factorOperator(num) {
        let value = num;
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
                        throw new CalcExpEvaluationError("接尾辞演算子が例外を投げました", e);
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
                    const obj = this.factor();
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
    factor() {
        const current = this.next();
        if (current == immutableConfiguration.PARENTHESIS[0]) {
            let value = this.polynomial();
            if (this.isOver()) {
                throw new CalcExpEvaluationError("括弧が閉じられていません");
            }
            const next = this.next();
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
            let num = this.number();
            if (Number.isNaN(num)) {
                throw new CalcExpEvaluationError("因数の解析中に関数または定数からのNaNの出力を検出しました");
            }
            return num;
        }
    }
    arguments() {
        const args = [];
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
            let value = this.polynomial();
            const next = this.next();
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
    isConst() {
        for (const name of this.sortIteratorInLongestOrder(this.CONSTANTS.keys())) {
            if (this.test(name)) {
                return true;
            }
        }
        return false;
    }
    getConst() {
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
    isFunction() {
        for (const name of this.sortIteratorInLongestOrder(this.FUNCTIONS.keys())) {
            if (this.test(name, immutableConfiguration.PARENTHESIS[0])) {
                return true;
            }
        }
        return false;
    }
    getFunction() {
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
    index() {
        if (this.location != 0) {
            this.location = 0;
            throw new CalcExpEvaluationError("カーソル位置が0ではありませんでした インスタンス自身がevaluate()を呼び出した可能性があります");
        }
        if (this.isOver()) {
            throw new CalcExpEvaluationError("空文字は計算できません");
        }
        const value = this.polynomial();
        if (this.expression.substring(this.location).length !== 0) {
            throw new CalcExpEvaluationError("式の終了後に無効な文字を検出しました");
        }
        return value;
    }
    evaluate(expression) {
        this.expression = expression;
        const value = this.index();
        if (Number.isNaN(value)) {
            throw new CalcExpEvaluationError("式からNaNが出力されました");
        }
        this.location = 0;
        this.expression = "";
        return value;
    }
    isDeclared(name, category) {
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
    getContextOf(category) {
        switch (category) {
            case CalcContextDeclarationCategory.CONSTANT:
                return new Set(this.CONSTANTS.keys());
            case CalcContextDeclarationCategory.FUNCTION:
                return new Set(this.FUNCTIONS.keys());
            case CalcContextDeclarationCategory.OPERATOR: {
                const set = new Set();
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
        }
        ;
    }
    declare(name, declarer, value) {
        if (name.includes(immutableConfiguration.PARENTHESIS[0])
            || name.includes(immutableConfiguration.PARENTHESIS[1])
            || name.includes(immutableConfiguration.COMMA)) {
            throw new TypeError(`定義名に無効な文字(${immutableConfiguration.PARENTHESIS[0]}, ${immutableConfiguration.PARENTHESIS[1]}, ${immutableConfiguration.COMMA})が含まれています`);
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
    undeclare(name, category) {
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
    clone() {
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
    constructor() {
        super();
    }
    declare(name, declarer, value) {
        super.declare(name, declarer, value);
    }
    undeclare(name, category) {
        super.undeclare(name, category);
    }
    clone() {
        return super.clone();
    }
    static newDefaultEvaluator() {
        const evaluator = new CalcExpEvaluator();
        // 四則演算 + 剰余 + 累乗 + 階乗
        evaluator.declare("+", CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, (x, y) => x + y);
        evaluator.declare("-", CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, (x, y) => x - y);
        evaluator.declare("*", CalcContextDeclarationCreator.OPERATOR_MONOMIAL, (x, y) => x * y);
        evaluator.declare("/", CalcContextDeclarationCreator.OPERATOR_MONOMIAL, (x, y) => x / y);
        evaluator.declare("%", CalcContextDeclarationCreator.OPERATOR_MONOMIAL, (x, y) => x % y);
        evaluator.declare("**", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => x ** y);
        evaluator.declare("!", CalcContextDeclarationCreator.SELF_OPERATOR_NUMBER_SUFFIX, x => {
            if (!Number.isInteger(x))
                throw new TypeError("階乗演算子は実質的な整数の値にのみ使用できます");
            else if (x < 0)
                throw new TypeError("階乗演算子は負の値に使用できません");
            else if (x > 127)
                throw new TypeError("階乗演算子は127!を超えた値を計算できないよう制限されています");
            let result = 1;
            for (let i = 2; i <= x; i++) {
                result *= i;
            }
            return result;
        });
        // ビット演算
        evaluator.declare("&", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y)))
                throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x & y;
        });
        evaluator.declare("|", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y)))
                throw new TypeError("|演算子は実質的な整数の値にのみ使用できます");
            return x | y;
        });
        evaluator.declare("^", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y)))
                throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x ^ y;
        });
        evaluator.declare("<<", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y)))
                throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x << y;
        });
        evaluator.declare(">>", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y)))
                throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x >> y;
        });
        evaluator.declare(">>>", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y)))
                throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
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
