# CalcExpEvaluator.ts

文字列を計算式として評価するやつ

- 文字列を計算式として評価して計算結果を`number`型で返す
- 新しく演算子、関数、定数を定義できる
- 既存の演算子、関数、定数を上書き・削除できる
- 定義名として指定する文字列に制約が少ないので柔軟 1+1=3みたいな意味の分からないこともできる

## Usage

### 導入
[このファイル](/src/CalcExpEvaluator.ts)を適当な場所に置けばok
<br>~~js?知りません~~

### 計算
`CalcExpEvaluator.newDefaultEvaluator()`は新しくデフォルトの計算機のインスタンスを作成する関数
<br>`new CalcExpEvaluator()`で何も定義されていないインスタンスを作成することも可能

```ts
import { CalcExpEvaluator } from "./CalcExpEvaluator.js"; // 一つのファイルに全部まとめてある

console.log(CalcExpEvaluator.newDefaultEvaluator().evaluate("1 + 1")); // 2
```

### 定義
`CalcExpEvaluator#declare()`は演算子・関数・定数を定義する関数

```ts
import { CalcExpEvaluator, CalcContextDeclarationCreator } from "./CalcExpEvaluator.js";

const evaluator = CalcExpEvaluator.newDefaultEvaluator();

evaluator.declare("ぷらす", CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, (x, y) => x + y);
evaluator.declare("sum", CalcContextDeclarationCreator.FUNCTION_VARIABLE_LENGTH_ARGS, args => args.reduce((x, y) => x + y));
evaluator.declare("g", CalcContextDeclarationCreator.CONSTANT, -9.8);

console.log(evaluator.evaluate("3 * (20 ぷらす 40)")); // 180
console.log(evaluator.evaluate("sum(1, 2, 3, 4)")); // 10
console.log(evaluator.evaluate("2 * g")); // -19.6
```

### 定義の削除・確認
`CalcExpEvaluator#undeclare()`は演算子・関数・定数の定義を削除する関数
<br>`CalcExpEvaluator#getContextOf()`は演算子・関数・定数の定義名のリストを取得する関数
<br>`CalcExpEvaluator#isDeclared()`は特定の名前の演算子・関数・定数が定義されているかを確かめる関数

```ts
import { CalcExpEvaluator, CalcContextDeclarationCategory } from "./CalcExpEvaluator.js";

const evaluator = CalcExpEvaluator.newDefaultEvaluator();

console.log(evaluator.getContextOf(CalcContextDeclarationCategory.OPERATOR)); // [+, -, *, /, %, ...]
evaluator.undeclare("/", CalcContextDeclarationCategory.OPERATOR);
console.log(evaluator.getContextOf(CalcContextDeclarationCategory.OPERATOR)); // [+, -, *, %, ...]

console.log(evaluator.isDeclared("NaN", CalcContextDeclarationCategory.CONSTANT)); // true
```

### ふざける

```ts
const evaluator = CalcExpEvaluator.newDefaultEvaluator();

// "2" を足し算記号として定義
evaluator.declare("2", CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, (x, y) => x + y);

console.log(evaluator.evaluate("2 2 2")); // 2 + 2 = 4
```

その他の例は[test.ts](./src/test.ts)を参照のこと

## License
[MIT LICENSE](/LICENSE)

## Author
[@Takenoko_4096](https://x.com/Takenoko_4096)
