
import fs from 'node:fs';
import readline from 'readline';
import { stdout } from 'process';


import { file_dirs, file_paths, obj_descs } from '../config/options.js';
import { doImport, get_obj_from_veza, hasDupName, info, updateJSON } from '../utils/veza.js';
import { display_status, get_obj_metadata } from './status.js';

export async function evaluate_user_response(user_response) {

  if (user_response == 'c') {
    await user_input_check_name();
  }
  if (user_response == 'g') {
    await user_input_get_object();
  }
  else if (user_response == 'm') {
    return
  }
  else if (user_response == 'p') {
    await user_input_push_object();
  }
  else if (user_response == 's') {
    await display_status();
  }
  else if (user_response == 'u') {
    await user_input_update_object();
  }
  else if (user_response == 'x') {
    console.log("exiting...");
    process.exit();
  }
  return
}

export async function get_user_input(question, lowercase = true, echo_input = false, wipe_input = false) {

  return new Promise((resolve, reject) => {

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (user_response) => {

      if (echo_input) {
        console.log(user_response);
      }

      if (wipe_input) {
        const terminalWidth = stdout.columns;
        const lines = Math.ceil(user_response.length / terminalWidth);
  
        // Clear each line
        for (let i = 0; i < lines; i++) {
          // Move the cursor up one line
          process.stdout.write('\x1B[1A');
          // Clear the line
          process.stdout.write('\x1B[2K');
        }
      }

      rl.close();

      if (lowercase) { user_response = user_response.toLowerCase() }

      resolve(user_response);
    })
  })
}

async function user_input_check_name() {

  let question = `please enter the query name that you would like to check against ${global.dest_tenant}:\n`;

  let user_response = await get_user_input(question);

  if (await user_wants_to_bail(user_response)) { return user_response }

  console.log(user_response);

  const name_exists = await hasDupName(user_response);

  console.log(`name exists in ${global.dest_tenant}: ${name_exists}`);

  return
}

async function user_input_get_object() {

  let user_response;
  let question;
  let valid_inputs;

  // confirm source tenant
  question = `do you want to pull an object from ${global.src_tenant}? (Y/n) `;

  user_response = await get_user_input(question);

  if (await user_wants_to_bail(user_response)) { return user_response }

  // pulling a report or a query?
  question = `are you pulling a report (r) or a query (q)? `;

  valid_inputs = ['q', 'r'];

  const obj_type = await get_user_input(question);

  if (await user_wants_to_bail(user_response)) { return user_response }

  if (!(valid_inputs.includes(obj_type))) { return }

  // get object id
  const obj_desc = obj_descs[obj_type];

  question = `what is the id of the ${obj_desc}? `;

  const obj_id = await get_user_input(question);

  if (await user_wants_to_bail(user_response)) { return user_response }

  // get the object
  const json_obj = await get_obj_from_veza(obj_type, obj_id);

  // write original file to local disk
  fs.writeFile(file_paths.input, JSON.stringify(json_obj, null, 2), (err) => {
    if (err) throw err;
    return
  });

  // write original file to input path
  fs.writeFile(`${file_dirs.input}/${obj_id}.json`, JSON.stringify(json_obj, null, 2), (err) => {
    if (err) throw err;
    return
  });
  
  console.log(`retrieved ${obj_desc} from Veza and saved to ${file_paths.input}`);
  console.log(`retrieved ${obj_desc} from Veza and saved to ${file_dirs.input}/${obj_id}.json`);

  // if this is a report, store metadata about the object in a .csv file

  if (obj_desc == 'report') {
    await info(json_obj);
    console.log(`stored metadata about the file in the ./out folder`);
  }

  return
}

async function user_input_push_object() {

  if (!(fs.existsSync(file_paths.output))) {
    console.error(`no file in ${file_paths.output}`);
    return
  }

  let data = fs.readFileSync(file_paths.output, 'utf8');
  
  let json = JSON.parse(data);

  let metadata = await get_obj_metadata(json);

  // push new object to Veza tenant?
  let question = `do you want to push the ${metadata.type} ${metadata.name} to ${global.dest_tenant}? (Y/n) `;

  let user_response = await get_user_input(question);

  if (await user_wants_to_bail(user_response)) { return user_response }

  await doImport(json);
}

async function user_input_update_object() {

  let data = fs.readFileSync(file_paths.input, 'utf8');
  
  let json = JSON.parse(data);

  let metadata = await get_obj_metadata(json);

  // generate a new file without collisions
  let question = `do you want to update the ${metadata.type} ${metadata.name}? (Y/n) `;

  let user_response = await get_user_input(question);

  if (await user_wants_to_bail(user_response)) { return user_response }

  const updated_json = await updateJSON(json);

  fs.writeFile('./out/out.json', JSON.stringify(updated_json, null, 2), (err) => {
    if (err) throw err;        
    return
  });

  console.log(`stored a new json file in the /out folder`);

  return updated_json;
}

async function user_wants_to_bail(user_response) {
  if (user_response == 'n' || user_response == 'm') { return true }
  else if (user_response == 's') {
    await display_status();
    return true
  }
  else if (user_response == 'x') { process.exit() }
  return false
}
