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
import { CalcExpEvaluator } from "./CalcExpEvaluator"; // 一つのファイルに全部まとめてある

console.log(CalcExpEvaluator.newDefaultEvaluator().evaluate("1 + 1")); // 2
```

### 定義
`CalcExpEvaluator#registries`は演算子・関数・定数のレジストリ

```ts
import { CalcExpEvaluator, RegistryKey, FunctionArgCount, OperatorPriority } from "./CalcExpEvaluator";

const evaluator = CalcExpEvaluator.newDefaultEvaluator();
const registires = evaluator.registries;

registires.get(RegistryKey.OPERATOR).register("ぷらす", {
    priority: OperatorPriority.POLYNOMIAL,
    operate(x, y) {
        return x + y;
    }
});
registries.get(RegistryKey.FUNCTION).register("sum", {
    argCount: FunctionArgCount.VAR,
    call(args) {
        return args.reduce((a, b) => a + b, 0);
    }
});
registries.get(RegistryKey.CONSTANT).register("g", -9.8);

console.log(evaluator.evaluate("3 * (20 ぷらす 40)")); // 180
console.log(evaluator.evaluate("sum(1, 2, 3, 4)")); // 10
console.log(evaluator.evaluate("2 * g")); // -19.6
```

### 定義の削除・確認
`Registry#unregister`は演算子・関数・定数の定義を削除する関数
<br>`Registry#lookup`は演算子・関数・定数の定義を取得するためのオブジェクト

```ts
import { CalcExpEvaluator, RegistryKey } from "./CalcExpEvaluator";

const evaluator = CalcExpEvaluator.newDefaultEvaluator();

console.log(evaluator.registries.get(RegistryKey.OPERATOR)lookup..getInNameLongestOrder()); // [+, -, *, /, %, ...]
evaluator.registries.get(RegistryKey.OPERATOR).unregister("/");
console.log(evaluator.registries.get(RegistryKey.OPERATOR).lookup.getInNameLongestOrder()); // [+, -, *, %, ...]

console.log(evaluator.registries.get(RegistryKey.CONSTANT).lookup.has("NaN")); // true
```

その他の例は[test.ts](./src/test.ts)を参照のこと

## License
[MIT LICENSE](/LICENSE)

## Author
[@Takenoko_4096](https://x.com/Takenoko_4096)
