import { APIkeyWorks } from "./credCheck.js";
import { get_user_input } from "./user_input.js";

async function render_local_menu(dest_tenant, dest_api_key) {

    let src_tenant;
    let src_api_key;

    console.log("\nA source tenant has not been defined. What would you like to do?")

    let question = `\nc - copy the values from the destination tenant\ne - enter values for the source tenant and api key\nx - exit\n`;

    let user_response = await get_user_input(question);

    if (user_response == 'x') {
        console.log("exiting...");
        process.exit();
    }

    else if (user_response == 'e') {

        question = `what is the url of the source Veza tenant?\n`;

        src_tenant = await get_user_input(question);

        console.log ("the src tenant is: " + src_tenant);

        question = `what is the api_key of the source Veza tenant?\n`;

        src_api_key = await get_user_input(question, false, false, true);

        console.log("*****************")

        if (await APIkeyWorks(src_tenant, src_api_key)) {
            console.log("the api key works...");

            return { src_tenant, src_api_key }
        }
        else {
            console.error("the api did not work");

            src_tenant = "none";
            src_api_key = "none";

            return { src_tenant, src_api_key }
        }
    }

    else if (user_response == 'c') {

        src_tenant = dest_tenant;
        src_api_key = dest_api_key;

        return { src_tenant, src_api_key }
    }

    else {
        src_tenant = "none";
        src_api_key = "none";

        return { src_tenant, src_api_key }
    }
}

async function get_dest_tenant() {

    const dest_tenant = process.env.DEST_VEZA_URL;

    if (dest_tenant) {
        console.log('DEST_VEZA_URL is defined and has a value:', dest_tenant);

        const dest_api_key = process.env.DEST_VEZA_KEY;
    
        if (dest_api_key) {
          console.log('DEST_VEZA_KEY is defined and has a value');
        } else {
          console.error('DEST_VEZA_KEY is not defined or is empty');
          process.exit();
        }
      
        if (await APIkeyWorks(dest_tenant, dest_api_key)) {
          console.log("destination tenant available...");
    
          return { dest_tenant, dest_api_key }
        }
    } else {
        console.error('DEST_VEZA_URL is not defined or is empty');
        process.exit();
    }
}

async function get_src_tenant(dest_tenant, dest_api_key) {

    let src_tenant = process.env.SOURCE_VEZA_URL;
    let src_api_key;
  
    if (src_tenant) {
      console.log('SOURCE_VEZA_URL is defined and has a value:', src_tenant);
  
      src_api_key = process.env.SOURCE_VEZA_KEY;
  
      if (src_api_key) {
        console.log('SOURCE_VEZA_KEY is defined and has a value');
        if (await APIkeyWorks(src_tenant, src_api_key)) {
          console.log("the src api tenant and key combo work.");

          return { src_tenant, src_api_key }
        }
        else {
          console.log("the src api tenant and key combo did not work.");

          while (true) {

            const { src_tenant, src_api_key } = await render_local_menu(dest_tenant, dest_api_key);

            if (!(src_tenant == 'none')) {
                return { src_tenant, src_api_key }
            }
          }
        }
      } else {
        console.log('SOURCE_VEZA_KEY is not defined or is empty');

        while (true) {

            const { src_tenant, src_api_key } = await render_local_menu(dest_tenant, dest_api_key);

            if (!(src_tenant == 'none')) {
                return { src_tenant, src_api_key }
            }
        }
      }
    } else {
      console.log('SOURCE_VEZA_URL is not defined or is empty');

      while (true) {

        const { src_tenant, src_api_key } = await render_local_menu(dest_tenant, dest_api_key);

        if (!(src_tenant == 'none')) {
            return { src_tenant, src_api_key }
        }
      }
    }
}

export async function init() {

  console.log("************************************");
  console.log("initializing...");
  console.log("************************************");

  try {
    const { dest_tenant, dest_api_key } = await get_dest_tenant();

    const { src_tenant, src_api_key } = await get_src_tenant(dest_tenant, dest_api_key);

    return { dest_tenant, dest_api_key, src_tenant, src_api_key };

  } catch (error) {
        console.error('Error loading tenants and api keys:', error.message);
        process.exit(1); // Exit the process with an error code
  }
}
