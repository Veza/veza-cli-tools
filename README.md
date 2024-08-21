
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
* (3) Push the './out/out.json' object to the destination Veza tenant
* (4) Check for the existence of a query name in the destination tenant
* (5) Display configuration variables
* (x) exit
