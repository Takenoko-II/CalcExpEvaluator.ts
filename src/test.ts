import { EvaluatorCreateOptions } from "./CalcExpEvaluator.js";
import { CalcExpEvaluator, ImmutableCalcExpEvaluator, FunctionArgCount, OperatorPriority, DeclarationRegistryKey, DeclarationRegistries } from "./CalcExpEvaluator.js";

const evaluator = new CalcExpEvaluator({
    copySourceRegistries: DeclarationRegistries.DEFAULT,
    configuration: {
        allowNaN: true
    }
});

console.log(evaluator.evaluate("1 + 1")); // 2
console.log(evaluator.evaluate("3 * (2 + 7) + -14 / 2")); // 20

console.log(evaluator.evaluate("100 & 6")); // 4
console.log(evaluator.evaluate("2 << 3 + 10 | 4")); // 30

console.log(evaluator.evaluate("sin(to_radians(45)) * 2")); // 1.4142...

console.log(evaluator.evaluate("1 / Infinity")); // 0
console.log(evaluator.evaluate("180 / PI")); // 57.295...

evaluator.registries.get(DeclarationRegistryKey.FUNCTION).register("double", {
    argCount: FunctionArgCount.ONE,
    call(x) {
        return x * 2;
    }
});
console.log(evaluator.evaluate("double(2) * (double(5) + 2 ** 3)")); // 4 * (10 + 8) = 72

evaluator.registries.get(DeclarationRegistryKey.FUNCTION).register("sum", {
    argCount: FunctionArgCount.VAR,
    call(args) {
        return args.reduce((a, b) => a + b, 0);
    }
});
console.log(evaluator.evaluate("sum(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)")); // 1 + 2 + ... + 10 = 55

evaluator.registries.get(DeclarationRegistryKey.OPERATOR).register("==", {
    priority: OperatorPriority.FACTOR,
    operate(x, y) {
        return x === y ? 1 : 0;
    }
});
console.log(evaluator.evaluate("(50 + 50) == (20 + 80)")); // 1

evaluator.registries.get(DeclarationRegistryKey.CONSTANT).register("MY_INTELIGENCE", {
    value: 2
});
console.log(evaluator.evaluate("MY_INTELIGENCE")); // 2

evaluator.registries.get(DeclarationRegistryKey.CONSTANT).register("57", {
    value: 1
});
console.log(evaluator.evaluate("57 + 57")); // 2

evaluator.registries.get(DeclarationRegistryKey.FUNCTION).registerByDescriptor({
    rand_int: {
        argCount: FunctionArgCount.TWO,
        call(x, y) {
            const min: number = Math.min(x, y)
            const max: number = Math.max(x, y);

            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }
});
console.log(evaluator.evaluate("rand_int(-8, 8)")); // -8 ～ 8 の乱数
