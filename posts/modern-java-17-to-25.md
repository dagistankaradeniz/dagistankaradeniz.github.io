---
title: "Modern Java 17 → 25: The Language You Might Have Missed"
date: 2026-12-25
tags: java, jdk, java-17, java-21, java-25, records, sealed-classes, pattern-matching, virtual-threads, structured-concurrency, scoped-values, stream-gatherers, lts, openjdk, language-features
---

# Modern Java 17 → 25: The Language You Might Have Missed

Many codebases moved from Java 11 or 17 to 21 or 25 for the runtime benefits and kept writing Java 8-style code. This post is the short list of **language and API features that change how you write Java**, grouped by what they replace. Our June post covered the JVM side: heap, GC and JDK 11–25.

LTS releases: **17** (2021) → **21** (2023) → **25** (2025). "Final" below means the feature is out of preview.

---

## At a Glance

| Feature | Final in | Replaces |
|---|---|---|
| Records | 16 | Lombok `@Value`, hand-written DTOs |
| Text blocks | 15 | `"..." + "\n" +` concatenation |
| Switch expressions | 14 | Fall-through `switch` + temp variables |
| Pattern matching for `instanceof` | 16 | Cast after check |
| Sealed classes/interfaces | 17 | "Please don't extend this" comments |
| Pattern matching for `switch` + record patterns | 21 | Visitor pattern, `if/else instanceof` chains |
| Virtual threads | 21 | Reactive code written only to save threads |
| Sequenced collections | 21 | `list.get(list.size() - 1)` |
| Unnamed variables `_` | 22 | `ignored`, `unused` |
| Foreign Function & Memory API | 22 | JNI, `sun.misc.Unsafe` |
| Markdown doc comments `///` | 23 | HTML in Javadoc |
| Stream gatherers | 24 | Custom collectors and loops for windowing |
| Scoped values | 25 | `ThreadLocal` for request context |
| Compact source files & instance `main` | 25 | `public static void main(String[] args)` boilerplate |
| Module import declarations | 25 | Long import lists |
| Flexible constructor bodies | 25 | Static helper methods before `super(...)` |
| Structured concurrency | *preview in 25* | `ExecutorService` + manual cancellation |

---

## 1. Data Modelling: Records + Sealed Types

Together these give Java **algebraic data types**: a closed set of immutable variants.

```java
sealed interface Payment permits Card, BankTransfer, Wallet {}

record Card(String last4, Money amount) implements Payment {}
record BankTransfer(String iban, Money amount) implements Payment {}
record Wallet(String provider, Money amount) implements Payment {}
```

- **Records** generate the constructor, accessors, `equals`/`hashCode` and `toString`. You can validate in a compact constructor: `record Money(BigDecimal value) { Money { Objects.requireNonNull(value); } }`.
- **Sealed** types fix the set of subtypes. The compiler knows every case, which is what makes the next section safe.

---

## 2. Pattern Matching: Data-Oriented Programming

```java
String describe(Payment p) {
    return switch (p) {
        case Card(var last4, var amt) when amt.isLarge() -> "Large card payment ****" + last4;
        case Card c                  -> "Card ****" + c.last4();
        case BankTransfer(var iban, _) -> "Transfer from " + iban;
        case Wallet w                -> "Wallet: " + w.provider();
    };   // no default: the compiler checks exhaustiveness
}
```

- **Record patterns** take records apart in place, and they nest.
- **Guards** (`when`) add conditions.
- **Exhaustiveness**: add a new `Payment` subtype and every `switch` that doesn't handle it **fails to compile**. That's safer than the visitor pattern, with far less code.
- `_` ignores a component you don't need.
- `case null` is allowed. Without it, a `null` selector still throws an NPE.

Before (Java 8 style) this needed `instanceof` checks, casts and a `default` branch that silently swallowed new cases.

---

## 3. Everyday API and Syntax Improvements

```java
// Text blocks
String json = """
    {"id": %d, "status": "%s"}
    """.formatted(id, status);

// Switch expressions
int days = switch (month) {
    case FEBRUARY -> 28;
    case APRIL, JUNE, SEPTEMBER, NOVEMBER -> 30;
    default -> 31;
};

// Sequenced collections (List, Deque, LinkedHashSet, LinkedHashMap…)
var last = orders.getLast();
var newestFirst = orders.reversed();

// Pattern matching for instanceof
if (obj instanceof String s && !s.isBlank()) use(s);
```

**Stream gatherers** (Java 24) add custom intermediate operations, like `windowFixed`, `windowSliding`, `fold` and `scan`:

```java
Stream.of(1, 2, 3, 4, 5)
      .gather(Gatherers.windowSliding(3))
      .toList();   // [[1,2,3], [2,3,4], [3,4,5]]
```

**Compact source files** (Java 25) make scripts and teaching examples short. Together with the source launcher (`java Hello.java`) you don't need a build step:

```java
void main() {
    IO.println("Hello, Java 25");
}
```

---

## 4. Concurrency: Virtual Threads, Scoped Values, Structured Concurrency

- **Virtual threads** (21): millions of cheap threads, so plain blocking code scales again. Our June post on virtual threads vs WebFlux goes deeper. Java 24 removed most *pinning* issues with `synchronized`.

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    urls.forEach(u -> executor.submit(() -> fetch(u)));
}
```

- **Scoped values** (final in 25): immutable, bounded context passed down the call stack. Cheaper and safer than `ThreadLocal` with millions of virtual threads.

```java
static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

ScopedValue.where(CURRENT_USER, user).run(() -> handle(request));
// anywhere below: CURRENT_USER.get()
```

- **Structured concurrency** (still preview in 25): treat related subtasks as one unit. If one fails, the others are cancelled, and no thread outlives its scope. The API has changed between previews, so wait for it to be final before using it in production.

---

## 5. Smaller Things Worth Knowing

- **`var`** (10) for local variables: use it when the type is obvious from the right-hand side.
- **Helpful NullPointerExceptions** (14): messages name *which* reference was null.
- **Flexible constructor bodies** (25): validate arguments *before* calling `super(...)`.
- **Module import declarations** (25): `import module java.base;` imports all packages a module exports. Handy for scripts.
- **Foreign Function & Memory API** (22): call native libraries and manage off-heap memory without JNI.
- **Markdown doc comments** (23): write Javadoc with `///` and Markdown.
- **Withdrawn**: string templates were previewed in 21–22 and then removed. Don't build on them.

---

## Migration Tips

- Run with `--release 25` (or 21) and turn on preview features only in experiments.
- Tools like **[OpenRewrite](https://docs.openrewrite.org/)** recipes can migrate to records, pattern matching, text blocks and so on automatically.
- Start with the **domain model**: sealed interfaces + records + pattern-matching `switch` give the largest readability gain.
- Replace `ThreadLocal` request context with scoped values when you adopt virtual threads.

---

## References

- [OpenJDK JEP index](https://openjdk.org/jeps/0) — key JEPs: [395 Records](https://openjdk.org/jeps/395), [409 Sealed Classes](https://openjdk.org/jeps/409), [441 Pattern Matching for switch](https://openjdk.org/jeps/441), [440 Record Patterns](https://openjdk.org/jeps/440), [444 Virtual Threads](https://openjdk.org/jeps/444), [431 Sequenced Collections](https://openjdk.org/jeps/431), [456 Unnamed Variables](https://openjdk.org/jeps/456), [454 FFM API](https://openjdk.org/jeps/454), [467 Markdown Doc Comments](https://openjdk.org/jeps/467), [485 Stream Gatherers](https://openjdk.org/jeps/485), [506 Scoped Values](https://openjdk.org/jeps/506), [505 Structured Concurrency (5th preview)](https://openjdk.org/jeps/505), [511 Module Imports](https://openjdk.org/jeps/511), [512 Compact Source Files](https://openjdk.org/jeps/512), [513 Flexible Constructor Bodies](https://openjdk.org/jeps/513)
- [JDK 25 release page](https://openjdk.org/projects/jdk/25/) · [JDK 21](https://openjdk.org/projects/jdk/21/) · [JDK 17](https://openjdk.org/projects/jdk/17/)
- Brian Goetz, [Data-Oriented Programming in Java](https://www.infoq.com/articles/data-oriented-programming-java/) (InfoQ)
- [dev.java](https://dev.java/learn/) — official Java learning site
