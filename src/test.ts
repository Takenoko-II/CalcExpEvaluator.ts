import { CalcExpEvaluator, CalcContextDeclarationCreator } from "./CalcExpEvaluator.js";

const evaluator = CalcExpEvaluator.newDefaultEvaluator();

console.log(evaluator.evaluate("1 + 1")); // 2
console.log(evaluator.evaluate("3 * (2 + 7) + -14 / 2")); // 20

console.log(evaluator.evaluate("100 & 6")); // 4
console.log(evaluator.evaluate("2 << 3 + 10 | 4")); // 30

console.log(evaluator.evaluate("sin(to_radians(45)) * 2")); // 1.4142...

console.log(evaluator.evaluate("1 / Infinity")); // 0
console.log(evaluator.evaluate("180 / PI")); // 57.295...

evaluator.declare("double", CalcContextDeclarationCreator.FUNCTION_1_ARG, x => x * 2);
console.log(evaluator.evaluate("double(2) * (double(5) + 2 ** 3)")); // 4 * (10 + 8) = 72

evaluator.declare("sum", CalcContextDeclarationCreator.FUNCTION_VARIABLE_LENGTH_ARGS, args => args.reduce((a, b) => a + b));
console.log(evaluator.evaluate("sum(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)")); // 1 + 2 + ... + 10 = 55

evaluator.declare("==", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => x === y ? 1 : 0);
console.log(evaluator.evaluate("(50 + 50) == (20 + 80)")); // 1

evaluator.declare("myInteligence", CalcContextDeclarationCreator.CONSTANT, 2);
console.log(evaluator.evaluate("myInteligence")); // 2

evaluator.declare("57", CalcContextDeclarationCreator.CONSTANT, 1);
console.log(evaluator.evaluate("57 + 57")); // 2
