import minimist from "minimist";
import { JsonDB, Config } from "node-json-db";
import chalk from "chalk";
import { homedir } from "os";
import { join } from "path";

const JSON_DB_PATH =
  process.env.TODO_JSON_DB_PATH ?? join(homedir(), "/.todo.json");
let db: JsonDB;

async function main() {
  await initializeDB();

  const args = minimist(process.argv.slice(2));
  const [command, arg1] = args._;

  switch (command) {
    case undefined:
    case "ls":
      list();
      break;
    case "help":
      help();
      break;
    case "add":
      await argumentRequired(arg1)(() => add(arg1));
      list();
      break;
    case "rm":
      assertInvalidIndex(arg1);
      await argumentRequired(arg1)(() => remove(parseInt(arg1)));
      list();
      break;
    case "done":
      assertInvalidIndex(arg1);
      await done(parseInt(arg1));
      list();
      break;
    case "clear":
      if (arg1 === "todo") {
        await db.push("/todo", [], true);
      }
      if (arg1 === "done") {
        await db.push("/done", [], true);
      }
      list();
      break;
    default:
      help();
      break;
  }
}

function help() {
  console.log(`
Usage:

[Command]
'todo' - Aslias for 'todo ls'.
'help' - Show help.
'add {item}' - Add an item.
'done {item-idx}' - Mark an item as done.
'rm {item-idx}' - Remove an item.
'ls' - List all items.
'clear {todo | done}' - Clear all items of the list.
`);
}

function argumentRequired(
  arg: string,
  predicate: (item: string) => boolean = (item) => item != null
) {
  return <R>(func: () => R): R => {
    if (arg == null || !predicate(arg)) {
      console.error(`Argument required`);
      help();
      process.exit(1);
    }
    return func();
  };
}

async function list() {
  const todos = await db.getObject<Array<Item>>("/todo").then((data) =>
    data.map(({ text, createdAt }, index) => ({
      index,
      text,
      createdAt,
    }))
  );
  const dones = await db.getObject<Array<Item>>("/done").then((data) =>
    data.map(({ text, createdAt }, index) => ({
      index,
      text,
      createdAt,
    }))
  );

  printList("Todo", todos);
  console.log();
  printList("Done", dones);
}

async function add(text: string) {
  await db.push("/todo[]", {
    text,
    createdAt: Date.now(),
  });
}

async function done(idx: number) {
  const todo = await db.getObject<Item>(`/todo[${idx}]`);
  await db.push("/done[]", todo);
  await remove(idx);
}

async function remove(idx: number) {
  await db.delete(`/todo[${idx}]`);
}

function printList(listname: string, list: Item[]) {
  console.log(chalk.bold(`${listname}:`));
  list.forEach((item, index) => {
    console.log(
      `${index}. ${item.text} [${Intl.DateTimeFormat("ko", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(item.createdAt))}]`
    );
  });
}

async function initializeDB() {
  db = new JsonDB(new Config(JSON_DB_PATH, true, true, "/"));

  if (!(await db.exists("/todo"))) {
    db.push("/todo", []);
  }

  if (!(await db.exists("/done"))) {
    db.push("/done", []);
  }
}

function assertInvalidIndex(index: string) {
  if (isNaN(parseInt(index))) {
    console.error("Invalid argument");
    help();
    process.exit(1);
  }
}

interface Item {
  text: string;
  createdAt: number;
}

main();
