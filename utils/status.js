
import fs from 'node:fs';

import { file_dirs, file_paths } from '../config/options.js';

/******************************************************* */

export async function check_for_dirs() {

  for (const key in file_paths) {
    try {

      let path = file_dirs[key];

      if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
        console.log(`${path} created successfully!`);
      } else {
        console.log(`${path} already exists.`);
      }
    } catch (err) {
      console.error(`Error creating ${path}: `, err);
    }
  }
  return
}

export async function display_status() {

  console.log("\n");

  console.log("*******************");
  console.log("state report");
  console.log("*******************");
  console.log(`source tenant: ${global.src_tenant}`);
  console.log(`destination tenant: ${global.dest_tenant}`);
  console.log(`-------------------------------`);

  let data;
  let json;
  let metadata;

  for (let key in file_paths) {

    // let path = "." + file_paths[key];
    let path = file_paths[key];

    if (fs.existsSync(path)) { 

      data = fs.readFileSync(path, 'utf8');
  
      json = JSON.parse(data);
  
      metadata = await get_obj_metadata(json);
  
      console.log(`${key} file available in ${path}? true`);
  
      console.log(`${key} object type: ${metadata.type}`);
  
      console.log(`${key} object name: ${metadata.name}`);
    }
    else {
      console.log(`no ${key} file available in ${path}.`);
    }

    console.log(`-------------------------------`);
  }
}

export async function get_obj_metadata(obj) {

  let obj_metadata = {
    type: 'none',
    name: 'none'
  };

  if (obj.reports.length > 0) {
    obj_metadata.type = 'report';
    obj_metadata.name = obj.reports[0].name;
  } else {
    obj_metadata.type = 'query';
    obj_metadata.name = obj.queries[0].name;
  }
  return obj_metadata;
}
