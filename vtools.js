import 'dotenv/config';
import fs from 'node:fs';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';

/****************************************************************** */
import { file_paths, menu, optionList, sections } from './config/options.js';
import { init } from './utils/init.js';
import { check_for_dirs, display_status } from './utils/status.js';
import { evaluate_user_response, get_user_input } from './utils/user_input.js';
import { tidy } from './utils/veza.js';

/****************************************************************** */

async function evaluate_command_line_args(options) {
  if (options['help']) {
    const usage = commandLineUsage(sections);
    console.log(usage);
    return    
  }
  else if (options['tidy']) {

    if (options['src']) {

      const file_path = options['src'];

      if (fs.existsSync(file_path)) {
        const data = fs.readFileSync(file_path, 'utf-8');    
        const json = JSON.parse(data);

        const updated_json = await tidy(json);

        fs.writeFileSync(file_paths.output, JSON.stringify(updated_json, null, 2), (err) => {
          if (err) {
              console.error('Error writing to file:', err);
              throw err;
          }
          console.log('File has been written successfully.');
        });
      }
      else {
        console.error(`could not find the file ${file_path}`);
      }
    }
  }
}

/******************************************************************** */
async function main() {

  await check_for_dirs();

  const { dest_tenant, dest_api_key, src_tenant, src_api_key } = await init();

  global.dest_tenant = dest_tenant;
  global.dest_api_key = dest_api_key;
  global.src_tenant = src_tenant;
  global.src_api_key = src_api_key;

  console.log("\n\n");
  console.log("****************************************")
  console.log("Welcome to Veza command line tools!")
  console.log("****************************************")

  // get command line args
  const options = commandLineArgs(optionList);

  await evaluate_command_line_args(options);

  /*********************************************************************** */

  await display_status(dest_tenant, src_tenant);

  while (true) {
    let user_response = await get_user_input(menu);

    await evaluate_user_response(user_response);
  }

}

main()
