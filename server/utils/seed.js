require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Question = require('../models/Question');
const { generateTemporaryPassword } = require('./generatePassword');

const BCRYPT_ROUNDS = 12;

const QUESTIONS = [
  // ---- JavaScript ----
  { skill: 'JavaScript', type: 'mcq', difficulty: 'Easy', question: 'Which keyword declares a block-scoped variable in JavaScript?', options: ['var', 'let', 'function', 'static'], correctAnswer: 'let', explanation: '"let" (and "const") are block-scoped; "var" is function-scoped.' },
  { skill: 'JavaScript', type: 'code-output', difficulty: 'Easy', question: 'What does this log?', codeSnippet: "console.log(typeof null);", options: ['null', 'undefined', 'object', 'number'], correctAnswer: 'object', explanation: 'typeof null is the famous JS quirk that returns "object".' },
  { skill: 'JavaScript', type: 'code-output', difficulty: 'Medium', question: 'What is logged by this code?', codeSnippet: "const arr = [1, 2, 3];\nconsole.log(arr.map(n => n * 2));", options: ['[1,2,3]', '[2,4,6]', '[1,4,9]', 'undefined'], correctAnswer: '[2,4,6]', explanation: 'map() doubles every element, producing [2, 4, 6].' },
  { skill: 'JavaScript', type: 'debugging', difficulty: 'Medium', question: 'This function should return the sum of an array but throws an error. What is the bug?', codeSnippet: "function sum(arr) {\n  return arr.reduce((a, b) => a + b);\n}\nsum(); // called with no arguments", correctAnswer: 'no default argument / calling reduce on undefined', explanation: 'sum() is called with no arguments, so arr is undefined and .reduce cannot be called on it.', options: ['no default argument / calling reduce on undefined', 'reduce needs an initial value', 'arrow functions cannot be used in reduce', 'sum should use forEach instead'] },
  { skill: 'JavaScript', type: 'conceptual', difficulty: 'Hard', question: 'What does the JavaScript event loop use to schedule microtasks like Promise callbacks relative to macrotasks like setTimeout?', options: ['Microtasks run after every macrotask, before rendering and the next macrotask', 'Microtasks and macrotasks run in the same queue in insertion order', 'setTimeout always runs before Promise.then regardless of delay', 'Microtasks only run once per event loop tick, macrotasks run continuously'], correctAnswer: 'Microtasks run after every macrotask, before rendering and the next macrotask', explanation: 'The microtask queue is drained completely after each macrotask before the loop continues.' },
  { skill: 'JavaScript', type: 'code-output', difficulty: 'Hard', question: 'What is logged, and in what order?', codeSnippet: "console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nconsole.log('D');", options: ['A, D, C, B', 'A, B, C, D', 'A, D, B, C', 'A, C, D, B'], correctAnswer: 'A, D, C, B', explanation: 'Sync code (A, D) runs first, then microtasks (C), then macrotasks (B).' },
  { skill: 'JavaScript', type: 'conceptual', difficulty: 'Expert', question: 'What is the main difference between a WeakMap and a Map in JavaScript?', options: ['WeakMap keys must be objects and are garbage-collected when unreferenced elsewhere', 'WeakMap is faster for all operations', 'WeakMap supports primitive keys but Map does not', 'WeakMap keys are enumerable, Map keys are not'], correctAnswer: 'WeakMap keys must be objects and are garbage-collected when unreferenced elsewhere', explanation: 'WeakMap holds weak references to object keys, preventing memory leaks, and is not iterable.' },
  { skill: 'JavaScript', type: 'debugging', difficulty: 'Expert', question: 'This code is meant to create 3 buttons that log their own index, but all log "3". What is the classic bug?', codeSnippet: "for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 100);\n}", correctAnswer: 'var is function-scoped so all closures share the same i', options: ['var is function-scoped so all closures share the same i', 'setTimeout does not support closures', 'the loop runs too fast for setTimeout', 'console.log is asynchronous'], explanation: 'Using var means every callback closes over the same variable; use let for per-iteration scoping.' },

  // ---- React ----
  { skill: 'React', type: 'mcq', difficulty: 'Easy', question: 'Which hook lets a function component hold local state?', options: ['useEffect', 'useState', 'useRef', 'useMemo'], correctAnswer: 'useState', explanation: 'useState returns a state value and a setter function.' },
  { skill: 'React', type: 'conceptual', difficulty: 'Easy', question: 'What is JSX?', options: ['A syntax extension that compiles to React.createElement calls', 'A templating language executed on the server', 'A CSS-in-JS library', 'A state management library'], correctAnswer: 'A syntax extension that compiles to React.createElement calls', explanation: 'JSX is syntactic sugar transpiled (e.g. by Babel) into createElement calls.' },
  { skill: 'React', type: 'code-output', difficulty: 'Medium', question: 'How many times does "render" log when this component first mounts (StrictMode off)?', codeSnippet: "function Counter() {\n  const [n, setN] = useState(0);\n  console.log('render');\n  useEffect(() => { setN(1); }, []);\n  return null;\n}", options: ['1', '2', '3', '0'], correctAnswer: '2', explanation: 'It renders once initially, then again after the effect calls setN(1).' },
  { skill: 'React', type: 'debugging', difficulty: 'Medium', question: 'This effect causes an infinite render loop. Why?', codeSnippet: "useEffect(() => {\n  setData({ ...data, loaded: true });\n});", correctAnswer: 'missing dependency array causes the effect to run after every render', options: ['missing dependency array causes the effect to run after every render', 'setData cannot be used inside useEffect', 'spreading an object is not allowed in React', 'useEffect cannot update state'], explanation: 'Without a dependency array, the effect runs after every render, and updating state triggers another render.' },
  { skill: 'React', type: 'conceptual', difficulty: 'Hard', question: 'Why does React recommend using a stable "key" prop (not array index) when rendering a dynamic list?', options: ['Index keys can cause incorrect state/DOM reuse when items are reordered or removed', 'Keys are only used for accessibility', 'React requires keys to be strings, not numbers', 'Index keys improve rendering performance in all cases'], correctAnswer: 'Index keys can cause incorrect state/DOM reuse when items are reordered or removed', explanation: "React's reconciliation matches elements by key; unstable keys cause it to misattribute state to the wrong item." },
  { skill: 'React', type: 'code-output', difficulty: 'Hard', question: 'What value does this custom hook return on the second render after clicking increment once?', codeSnippet: "function useCount() {\n  const [count, setCount] = useState(0);\n  const inc = useCallback(() => setCount(c => c + 1), []);\n  return [count, inc];\n}", options: ['0', '1', '2', 'undefined'], correctAnswer: '1', explanation: 'The functional updater correctly increments from 0 to 1 on the first click.' },
  { skill: 'React', type: 'conceptual', difficulty: 'Expert', question: 'What problem does React.memo solve, and when can it fail to prevent a re-render?', options: ['It skips re-rendering when props are shallow-equal, but fails if a new object/array/function prop is passed each render', 'It permanently caches a component forever', 'It replaces the need for keys in lists', 'It prevents all child components from ever re-rendering'], correctAnswer: 'It skips re-rendering when props are shallow-equal, but fails if a new object/array/function prop is passed each render', explanation: 'Inline object/array/function props are recreated every render, breaking shallow equality checks.' },
  { skill: 'React', type: 'debugging', difficulty: 'Expert', question: 'This component leaks a subscription. What is missing?', codeSnippet: "useEffect(() => {\n  const sub = api.subscribe(handleData);\n}, []);", correctAnswer: 'missing cleanup function to unsubscribe', options: ['missing cleanup function to unsubscribe', 'useEffect cannot call external APIs', 'the dependency array should not be empty', 'subscribe should be called outside useEffect'], explanation: 'The effect should return a cleanup function that calls sub.unsubscribe() to avoid leaks on unmount.' },

  // ---- Node.js ----
  { skill: 'Node.js', type: 'mcq', difficulty: 'Easy', question: 'Which built-in Node.js module is used to create an HTTP server?', options: ['fs', 'http', 'path', 'events'], correctAnswer: 'http', explanation: 'The core "http" module provides createServer().' },
  { skill: 'Node.js', type: 'conceptual', difficulty: 'Easy', question: 'What does "require" do in a CommonJS Node.js module?', options: ['Synchronously loads and caches a module', 'Asynchronously fetches a module over HTTP', 'Declares a global variable', 'Compiles TypeScript files'], correctAnswer: 'Synchronously loads and caches a module', explanation: 'require() reads, evaluates and caches the module synchronously.' },
  { skill: 'Node.js', type: 'code-output', difficulty: 'Medium', question: 'What is the output order?', codeSnippet: "console.log('start');\nprocess.nextTick(() => console.log('tick'));\nsetImmediate(() => console.log('immediate'));\nconsole.log('end');", options: ['start, end, tick, immediate', 'start, tick, end, immediate', 'start, end, immediate, tick', 'start, tick, immediate, end'], correctAnswer: 'start, end, tick, immediate', explanation: 'Sync code runs first, then process.nextTick callbacks, then setImmediate.' },
  { skill: 'Node.js', type: 'debugging', difficulty: 'Medium', question: 'This Express route never sends a response for invalid input. What is the bug?', codeSnippet: "app.post('/x', (req, res) => {\n  if (!req.body.name) {\n    // TODO: handle error\n  }\n  res.json({ ok: true });\n});", correctAnswer: 'missing return/response inside the if block, so it falls through', options: ['missing return/response inside the if block, so it falls through', 'app.post does not support validation', 'req.body is always undefined', 'res.json cannot be called conditionally'], explanation: 'Without responding (or returning) inside the if block, execution falls through and always sends ok:true.' },
  { skill: 'Node.js', type: 'conceptual', difficulty: 'Hard', question: 'Why is it dangerous to run CPU-intensive synchronous code in a Node.js request handler?', options: ['It blocks the single-threaded event loop, stalling all other requests', 'Node.js cannot execute synchronous code at all', 'It causes a memory leak automatically', 'It only affects that one request, never others'], correctAnswer: 'It blocks the single-threaded event loop, stalling all other requests', explanation: 'Node runs JS on one thread; long synchronous work blocks all concurrent I/O and requests.' },
  { skill: 'Node.js', type: 'code-output', difficulty: 'Hard', question: 'What happens when this runs?', codeSnippet: "async function main() {\n  try {\n    await Promise.reject(new Error('fail'));\n  } catch (e) {\n    console.log('caught:', e.message);\n  }\n}\nmain();", options: ["logs 'caught: fail'", 'throws an unhandled rejection', 'logs undefined', 'does nothing'], correctAnswer: "logs 'caught: fail'", explanation: 'await on a rejected promise throws synchronously inside the try block, so the catch handles it.' },
  { skill: 'Node.js', type: 'conceptual', difficulty: 'Expert', question: 'What is the key difference between clustering and worker_threads in Node.js?', options: ['Cluster forks separate processes with isolated memory; worker_threads share memory via SharedArrayBuffer within one process', 'They are functionally identical', 'worker_threads cannot run JavaScript', 'Cluster is only for HTTPS servers'], correctAnswer: 'Cluster forks separate processes with isolated memory; worker_threads share memory via SharedArrayBuffer within one process', explanation: 'cluster scales across CPU cores using separate OS processes; worker_threads enable shared-memory concurrency within one process.' },
  { skill: 'Node.js', type: 'debugging', difficulty: 'Expert', question: 'This middleware causes memory growth over time in production. Why?', codeSnippet: "const cache = {};\napp.use((req, res, next) => {\n  cache[req.url] = req.body;\n  next();\n});", correctAnswer: 'unbounded in-memory cache never evicts entries, growing forever', options: ['unbounded in-memory cache never evicts entries, growing forever', 'middleware functions cannot use closures', 'req.body is always empty', 'app.use runs only once at startup'], explanation: 'Every unique URL adds an entry that is never removed, leaking memory indefinitely.' },

  // ---- MongoDB ----
  { skill: 'MongoDB', type: 'mcq', difficulty: 'Easy', question: 'Which MongoDB method finds a single document matching a filter?', options: ['find()', 'findOne()', 'insertOne()', 'aggregate()'], correctAnswer: 'findOne()', explanation: 'findOne() returns the first matching document or null.' },
  { skill: 'MongoDB', type: 'conceptual', difficulty: 'Easy', question: 'What is a MongoDB "collection" roughly equivalent to in a relational database?', options: ['A table', 'A row', 'A column', 'A database'], correctAnswer: 'A table', explanation: 'A collection groups documents, similar to how a table groups rows.' },
  { skill: 'MongoDB', type: 'code-output', difficulty: 'Medium', question: 'Given documents {a:1},{a:2},{a:3}, what does this return?', codeSnippet: "db.nums.find({ a: { $gt: 1 } }).count()", options: ['1', '2', '3', '0'], correctAnswer: '2', explanation: 'Two documents (a:2, a:3) satisfy a > 1.' },
  { skill: 'MongoDB', type: 'debugging', difficulty: 'Medium', question: 'This query is slow on a large collection. What is the most likely fix?', codeSnippet: "db.users.find({ email: 'a@b.com' })", correctAnswer: 'create an index on the email field', options: ['create an index on the email field', 'switch to findOne instead of find', 'use $where instead of a plain filter', 'increase the connection pool size'], explanation: 'Without an index, MongoDB performs a full collection scan; indexing the queried field fixes this.' },
  { skill: 'MongoDB', type: 'conceptual', difficulty: 'Hard', question: 'Why might you choose to embed a sub-document instead of referencing it with an ObjectId in MongoDB schema design?', options: ['When the data is always accessed together and rarely updated independently, embedding avoids extra queries', 'Embedding is always faster regardless of access pattern', 'References are not supported in MongoDB', 'Embedding is required for indexes to work'], correctAnswer: 'When the data is always accessed together and rarely updated independently, embedding avoids extra queries', explanation: 'Embedding trades normalization for read performance when sub-data is tightly coupled to the parent.' },
  { skill: 'MongoDB', type: 'code-output', difficulty: 'Hard', question: 'What does this aggregation stage do?', codeSnippet: "db.orders.aggregate([\n  { $group: { _id: '$customerId', total: { $sum: '$amount' } } }\n])", options: ['Sums order amounts grouped by customer', 'Filters orders by customer', 'Sorts orders by amount', 'Deletes orders with no amount'], correctAnswer: 'Sums order amounts grouped by customer', explanation: '$group with $sum aggregates amount per distinct customerId.' },
  { skill: 'MongoDB', type: 'conceptual', difficulty: 'Expert', question: 'What consistency guarantee does MongoDB provide for a single-document update by default?', options: ['Atomicity — a single document update is always applied entirely or not at all', 'Full ACID transactions across all documents by default', 'Eventual consistency only, even for one document', 'No consistency guarantee without explicit locking'], correctAnswer: 'Atomicity — a single document update is always applied entirely or not at all', explanation: 'MongoDB guarantees atomicity at the single-document level even without multi-document transactions.' },
  { skill: 'MongoDB', type: 'debugging', difficulty: 'Expert', question: 'This schema causes documents to exceed the 16MB limit over time. What is the design flaw?', codeSnippet: "// Comments array embedded directly in each BlogPost document,\n// growing unbounded as more comments are added.", correctAnswer: 'unbounded array embedding — comments should be a separate referenced collection', options: ['unbounded array embedding — comments should be a separate referenced collection', 'MongoDB does not support arrays', 'BlogPost should not have an _id', 'the 16MB limit applies per field, not per document'], explanation: 'Unbounded child arrays should be split into their own collection referencing the parent to avoid the per-document size limit.' },
];

const EXTRA_EASY_MEDIUM = [
  { skill: 'Python', type: 'mcq', difficulty: 'Easy', question: 'Which keyword defines a function in Python?', options: ['func', 'def', 'function', 'lambda'], correctAnswer: 'def', explanation: '"def" introduces a function definition.' },
  { skill: 'Python', type: 'code-output', difficulty: 'Medium', question: 'What does this print?', codeSnippet: "print([x*x for x in range(4)])", options: ['[0,1,4,9]', '[1,4,9,16]', '[0,1,2,3]', 'Error'], correctAnswer: '[0,1,4,9]', explanation: 'range(4) is 0,1,2,3; squaring gives 0,1,4,9.' },
  { skill: 'Python', type: 'conceptual', difficulty: 'Hard', question: 'What is the GIL in CPython?', options: ['A global lock that allows only one thread to execute Python bytecode at a time', 'A garbage collector for unused imports', 'A security feature restricting file access', 'A tool for dependency management'], correctAnswer: 'A global lock that allows only one thread to execute Python bytecode at a time', explanation: 'The Global Interpreter Lock serializes bytecode execution across threads in CPython.' },
  { skill: 'Python', type: 'debugging', difficulty: 'Expert', question: 'This function has a subtle mutable default argument bug. What happens on repeated calls?', codeSnippet: "def add_item(item, items=[]):\n    items.append(item)\n    return items", correctAnswer: 'the default list is shared and grows across calls instead of resetting', options: ['the default list is shared and grows across calls instead of resetting', 'append() does not work on lists', 'Python does not support default arguments', 'the function raises a TypeError'], explanation: 'Default mutable arguments are evaluated once, so the same list persists and accumulates across calls.' },

  { skill: 'SQL', type: 'mcq', difficulty: 'Easy', question: 'Which SQL clause filters rows before grouping?', options: ['HAVING', 'WHERE', 'GROUP BY', 'ORDER BY'], correctAnswer: 'WHERE', explanation: 'WHERE filters rows before aggregation; HAVING filters after GROUP BY.' },
  { skill: 'SQL', type: 'code-output', difficulty: 'Medium', question: 'What does this query return?', codeSnippet: "SELECT COUNT(*) FROM orders WHERE amount > 100;", options: ['The number of orders with amount greater than 100', 'The sum of all order amounts', 'All orders sorted by amount', 'An error'], correctAnswer: 'The number of orders with amount greater than 100', explanation: 'COUNT(*) with a WHERE filter counts matching rows.' },
  { skill: 'SQL', type: 'conceptual', difficulty: 'Hard', question: 'What is the difference between an INNER JOIN and a LEFT JOIN?', options: ['INNER JOIN returns only matching rows; LEFT JOIN also returns unmatched rows from the left table with NULLs', 'They always return the same result', 'LEFT JOIN is faster in every case', 'INNER JOIN cannot use conditions'], correctAnswer: 'INNER JOIN returns only matching rows; LEFT JOIN also returns unmatched rows from the left table with NULLs', explanation: 'LEFT JOIN preserves all left-table rows even without a match on the right.' },

  { skill: 'Java', type: 'mcq', difficulty: 'Easy', question: 'Which keyword is used to create a subclass in Java?', options: ['implements', 'extends', 'inherits', 'super'], correctAnswer: 'extends', explanation: '"extends" is used for class inheritance in Java.' },
  { skill: 'Java', type: 'code-output', difficulty: 'Medium', question: 'What is printed?', codeSnippet: "int a = 5;\nint b = 2;\nSystem.out.println(a / b);", options: ['2.5', '2', '3', 'Error'], correctAnswer: '2', explanation: 'Integer division truncates toward zero, so 5/2 is 2.' },
  { skill: 'Java', type: 'conceptual', difficulty: 'Hard', question: 'What is the purpose of the "final" keyword on a Java variable?', options: ['It prevents the variable from being reassigned after initialization', 'It makes the variable static', 'It makes the variable thread-local', 'It deletes the variable after use'], correctAnswer: 'It prevents the variable from being reassigned after initialization', explanation: 'A final variable can be assigned once; reassignment is a compile error.' },

  { skill: 'HTML', type: 'mcq', difficulty: 'Easy', question: 'Which tag is used to link an external CSS file?', options: ['<style>', '<link>', '<script>', '<css>'], correctAnswer: '<link>', explanation: '<link rel="stylesheet" href="..."> loads an external stylesheet.' },
  { skill: 'CSS', type: 'mcq', difficulty: 'Easy', question: 'Which CSS property controls the space outside an element\'s border?', options: ['padding', 'margin', 'border', 'outline'], correctAnswer: 'margin', explanation: 'margin is the space outside the border; padding is inside it.' },
  { skill: 'CSS', type: 'conceptual', difficulty: 'Medium', question: 'What does "flex: 1" typically do to a flex item?', options: ['Allows it to grow and shrink to fill available space equally with other flex:1 siblings', 'Fixes its width to 1px', 'Removes it from the flex layout', 'Makes it the first item always'], correctAnswer: 'Allows it to grow and shrink to fill available space equally with other flex:1 siblings', explanation: 'flex: 1 is shorthand for flex-grow:1, flex-shrink:1, flex-basis:0%.' },

  { skill: 'Git', type: 'mcq', difficulty: 'Easy', question: 'Which command stages all changes for commit?', options: ['git commit -a', 'git add .', 'git push', 'git stage'], correctAnswer: 'git add .', explanation: 'git add . stages all changes in the current directory.' },
  { skill: 'Git', type: 'conceptual', difficulty: 'Medium', question: 'What does "git rebase" do differently from "git merge"?', options: ['It replays commits on top of another branch, producing a linear history', 'It deletes the branch after merging', 'It only works on remote branches', 'It is identical to merge in every way'], correctAnswer: 'It replays commits on top of another branch, producing a linear history', explanation: 'Rebase re-applies commits onto a new base instead of creating a merge commit.' },
];

// Aptitude is skill-independent — the pseudo-skill "Aptitude" plugs it into
// the existing per-skill adaptive engine with zero changes to that engine.
const APTITUDE_QUESTIONS = [
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Easy', question: 'If a train travels 60 km in 1.5 hours, what is its average speed?', options: ['30 km/h', '40 km/h', '45 km/h', '90 km/h'], correctAnswer: '40 km/h', explanation: '60 / 1.5 = 40 km/h.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Easy', question: 'Find the next number in the series: 2, 4, 6, 8, ?', options: ['9', '10', '12', '16'], correctAnswer: '10', explanation: 'The series increases by 2 each time.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Easy', question: 'Choose the word most similar in meaning to "Concise".', options: ['Lengthy', 'Brief', 'Vague', 'Loud'], correctAnswer: 'Brief', explanation: '"Concise" means expressed in few words; "brief" is the closest synonym.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Easy', question: 'A shop sells a pen for $12 after a 20% discount on the marked price. What was the marked price?', options: ['$14', '$15', '$16', '$18'], correctAnswer: '$15', explanation: '12 = 0.8 × price, so price = 12 / 0.8 = 15.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Medium', question: 'A can complete a job in 6 days and B in 12 days. Working together, how many days will they take?', options: ['3 days', '4 days', '6 days', '9 days'], correctAnswer: '4 days', explanation: 'Combined rate = 1/6 + 1/12 = 1/4, so 4 days.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Medium', question: 'If the ratio of boys to girls in a class is 3:2 and there are 30 students, how many are girls?', options: ['10', '12', '15', '18'], correctAnswer: '12', explanation: '3+2=5 parts; 30/5=6 per part; girls = 2×6 = 12.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Medium', question: 'Statement: "All engineers are punctual. Some punctual people are managers." Which conclusion follows?', options: ['All managers are engineers', 'All engineers are managers', 'Some engineers may be managers', 'No engineers are managers'], correctAnswer: 'Some engineers may be managers', explanation: 'The overlap between engineers and managers is only possible, not guaranteed either way — "may be" is the only valid conclusion.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Medium', question: 'A sum of money doubles itself in 8 years at simple interest. What is the rate of interest?', options: ['8%', '10%', '12.5%', '15%'], correctAnswer: '12.5%', explanation: 'SI doubling means interest = principal over 8 years, so rate = 100/8 = 12.5%.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Hard', question: 'In a race of 200m, A beats B by 20m. If A gives B a 20m head start, who wins and by how much (assuming constant speeds)?', options: ['A wins by 20m', 'B wins by 20m', 'They tie', 'A wins by 40m'], correctAnswer: 'They tie', explanation: 'A runs 200m in the time B runs 180m. With a 20m head start, B needs to cover 180m in that same time — exactly matching, so it is a tie.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Hard', question: 'Five friends sit in a row. P is right of Q, left of R. S is right of R, left of T. Who is in the middle?', options: ['P', 'Q', 'R', 'S'], correctAnswer: 'R', explanation: 'Order works out to Q, P, R, S, T — R is the middle (3rd of 5).' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Hard', question: 'A mixture contains milk and water in the ratio 5:3. If 16 liters of water is added, the ratio becomes 5:7. Find the initial quantity of milk.', options: ['15 L', '20 L', '25 L', '30 L'], correctAnswer: '20 L', explanation: 'Let milk=5x, water=3x. (3x+16)/5x = 7/5 → 15x+80=35x → x=4 → milk=20L.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Expert', question: 'A cistern has two inlet pipes and one outlet pipe. Inlet A fills it in 6h, inlet B in 8h, outlet C empties it in 12h. If all three are opened together, how long to fill the cistern?', options: ['4 hours', '4.8 hours', '5.5 hours', '6 hours'], correctAnswer: '4.8 hours', explanation: 'Combined rate = 1/6 + 1/8 - 1/12 = 5/24 per hour, so time = 24/5 = 4.8 hours.' },
  { skill: 'Aptitude', type: 'mcq', difficulty: 'Expert', question: 'In how many ways can the letters of the word "LEADER" be arranged such that the vowels always come together?', options: ['72', '120', '144', '240'], correctAnswer: '72', explanation: 'LEADER has vowels E, A, E (E repeats) and consonants L, D, R. Treat the vowel block as one unit: arrange {block, L, D, R} in 4! = 24 ways, and arrange E, A, E within the block in 3!/2! = 3 ways. Total = 24 × 3 = 72.' },
];

const ALL_QUESTIONS = [...QUESTIONS, ...EXTRA_EASY_MEDIUM, ...APTITUDE_QUESTIONS];

const TYPE_TO_CATEGORY = { 'mcq': 'technical', 'conceptual': 'technical', 'code-output': 'coding', 'debugging': 'debugging' };

function categoryFor(q) {
  if (q.skill === 'Aptitude') return 'aptitude';
  return TYPE_TO_CATEGORY[q.type] || 'technical';
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@hirevion.local').toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`[seed] admin already exists: ${email}`);
    return;
  }

  const temporaryPassword = process.env.ADMIN_PASSWORD || generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
  await User.create({ email, passwordHash, role: 'admin', temporaryPassword: true });

  console.log('[seed] admin account created:');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${temporaryPassword}`);
  console.log('  (change this immediately after first login — it will not be shown again)');
}

async function seedQuestions() {
  let created = 0;
  for (const q of ALL_QUESTIONS) {
    const exists = await Question.findOne({ skill: q.skill, question: q.question });
    if (exists) continue;
    await Question.create({ ...q, category: categoryFor(q) });
    created += 1;
  }

  // Backfill category on any pre-existing questions from before the
  // category field existed — safe no-op once every document has it set.
  const uncategorized = await Question.find({ category: { $exists: false } });
  for (const q of uncategorized) {
    q.category = categoryFor(q);
    await q.save();
  }
  if (uncategorized.length > 0) {
    console.log(`[seed] backfilled category on ${uncategorized.length} existing question(s)`);
  }
  console.log(`[seed] questions created: ${created} (skipped ${ALL_QUESTIONS.length - created} already present)`);
}

async function run() {
  await connectDB();
  await seedAdmin();
  await seedQuestions();
  console.log('[seed] done');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
