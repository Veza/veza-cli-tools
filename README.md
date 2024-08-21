
# Veza CLI tools

Tools to make your life at Veza happier

# Copying a Report from one Veza tenant to another

This capability allows you to copy a Report (and the queries it depends on) from one Veza tenant to a different Veza tenant.

## Basic flow

The basic flow is this (more detailed steps below):

From the "source" Veza tenant, get the json for the report that you want to copy.

Point this script at that json.

The script will generate a new json file.

Import the new json into the destination Veza tenant.

## Setup

### Environment variables
Copy the file `.env.example` to `.env`
Update the values in `.env`
Save `.env`

These values should come from the *destination* Veza tenant.

You can also set values for the *source* Veza tenant if you intend to download objects using the script.

### Install dependencies

`npm install`

## Run / detailed process

To run the script in interactive mode:

`npm run vtools`

You will be presented with several options:
* (1) Export a Report or Query from the source Veza tenant and save it as `./in/in.json`
* (2) Prepare the `./in/in.json` (update Ids to avoid collisions) and save the result to `./out/out.json`
* (3) Push the `./out/out.json` object to the destination Veza tenant
* (4) Check for the existence of a query name in the destination tenant
* (5) Display configuration variables
* (x) exit

Once you pick an option, follow the prompts and the CLI will guide you. 

**Example workflow**
1. After having configured your `.env` file with "source" and "destination" environment variables, you run the command `npm run vtools`. 
2. Choose option (1) to export a query from the "source" tenant. You will be prompted to specify whether you want to export a Query or a Report. Make your selection.
3. Next, you will be prompted to provide the query or report Id. Enter the value and click enter.
4. The Report or Query will be exported to the `./in/in.json` file. A copy of it is also saved in the `./in` directory with a filename that matches the Id you provided.
5. Next, choose option (2). This operation verifies the definition in `./in/in.json` against the "destination" tenant to check for duplicate Ids and Names. If duplicates are found, it automatically updates the JSON so that collisions can be avoided. Note that the query/report definitions aren't being updated, just Names and Ids. The final payload is saved into the `./out/out.json` file.
6. Next, choose option (3). The CLI will push the `./out/out.json` as a payload int the "destination" tenant.


**Alternate workflow**
You may already have a saved Report/Query definition, in which case you want to skip step 2. Simply copy the JSON to `./in/in.json`, and perform step 5 and 6 from above.
