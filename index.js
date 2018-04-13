const express = require('express')
const request = require('request');

const base_url = 'http://autumn-resonance-1298.getsandbox.com/';
const endpoint_inv = 'inventory';
const endpoint_prod = 'products';
const status_ok = 'OK';
const status_err = 'ERROR';

var errors_list = [];
var warnings_list = [];
 
var app = express()
app.listen(3000)

/*
Handler - get all products
async function and await operator to make sure that the fetchData HTTP request comes back.
Otherwise we end up with no inventory.
*/
app.get('/products', async (req, res) => {
	errors_list = [];
	warnings_list = [];

	var inv_resp;
	var inv_list = [];
	var prod_list = [];
	var master_list = [];

	console.log("request for all products");

	prod_list = await fetchData(endpoint_prod);
	inv_resp = await fetchData(endpoint_inv);
	inv_list = inv_resp.inventory;
	master_list = processResults(prod_list, inv_list);
  res.json({products: master_list, errors: errors_list, warnings: warnings_list});
})

/*
Handler - get product with name = :name
async function and await operator to make sure that the fetchInventory HTTP request comes back.
Otherwise we end up with no inventory.
*/
app.get('/products/:name', async (req, res) => {
	errors_list = [];
	warnings_list = [];

	var name;
	var prod_resp;
	var inv_resp;
	var inv_list = [];
	var prod_list = [];
	var master_list = [];

	name = req.params.name; 
	console.log("request for product '" + name + "'");

	prod_resp = await fetchData(endpoint_prod, name);
	prod_list = prod_resp.product;
	inv_resp = await fetchData(endpoint_inv, name);
	inv_list = inv_resp.inventory;
	master_list = processResults(prod_list, inv_list, name);
  res.json({products: master_list, errors: errors_list, warnings: warnings_list});
})
  
/*
Handler - get get all inventory; called by get all products handler
*/
app.get('/inventory', async (req, res) => {
	var inventory;
	
	console.log("request inventory for all products");

	inventory = await queryInventory()
  res.json({'status' : 'OK','inventory' : inventory})
})
 
/*
Handler - get get inventory for specific product; called by get spec product handler
*/
app.get('/inventory/:name', async (req, res) => {
	var name;
	var inventory;

	name = req.params.name; 
	console.log("request inventory for product '" + name + "'");

	inventory = await queryInventory(name); 
  res.json({'status' : 'OK','inventory' : inventory})
})
 
/*
First make sure the results set is even valid. if they aren't valid, just return the empty master_list.
Then hopefully pair the prod list element(s) with the inventory list element(s) and return the
master_list.
*/
function processResults(prod_list, inventory_list, name) {

	var master_list = [];

	console.log("prod_list is " + prod_list);
	console.log("inventory_list is " + inventory_list);
	if (validateResults(prod_list, inventory_list, name) == false) {
		return master_list;
	}

	for (i = 0; i < prod_list.length; i++) {
		for(j = 0; j < inventory_list.length; j++) {
			if (prod_list[i]['name'] == inventory_list[j]['name']){
				master_list[i] = prod_list[i];
				master_list[i]['inventory'] = inventory_list[j]['inventory'];
				break;
			}
		}
	}
	return master_list;
}
 
/*
Validation.
Note that this wil populate both errors and warnings lists that will be returned
to the requestor as part of the response.
*/
function validateResults(prod_list, inventory_list, name) {

	console.log("validateResults...");
	var process_ok = true;

	/* 
	Somehow we got no prod information.
	Add a message to the errors list and set a flag; but note that we're
	going to keep going so that we can catch other errors that might be there.
	*/
	if(prod_list.length == 0) {
		if (name == undefined) {
			errors_list.push('prod list is empty');
		} else {
			errors_list.push("0 prod entries match product name '" + name + "'");
		}
		process_ok = false;
	}

	/* 
	Somehow we got no inventory information.
	Add a message to the errors list and set a flag like before.
	*/
	if(inventory_list.length == 0) {
		if (name == undefined) {
			errors_list.push('inventory list is empty');
		} else {
			errors_list.push("0 inventory entries match product name '" + name + "'");
		}
		process_ok = false;
	}

	/*
	At this point if one or both lists are empty we can't go anywhere other than 
	returning a flag to the process function. 
	*/
	if (process_ok == false) {
		return false
	}

	/*
	Add some warnings. If one or more items have no corresponding item on the
	other list, we won't error since we can still provide a partial product list.
	So instead we add a warning about the missing item.
	*/
	var matches = 0;
	for (i = 0; i < prod_list.length; i++) {
		var has_match = false;
		for(j = 0; j < inventory_list.length; j++) {
			if(inventory_list[j]['name'] == prod_list[i]['name'] ) {
				matches++;
				has_match = true;
				continue;
			}
		}
		if (has_match == false) {
			warnings_list.push("no inventory entry for product '" + prod_list[i]['name'] + "'" );
		}
	}

	/*
	Same thing as above, just going the other direction.
	*/
	for(i = 0; i < inventory_list.length; i++) {
		var has_match = false;
		for (j = 0; j < prod_list.length; j++) {
			if(inventory_list[i]['name'] == prod_list[j]['name'] ) {
				matches++;
				has_match = true;
				continue;
			}
		}
		if (has_match == false) {
			warnings_list.push("no prod entry for product '" + inventory_list[i]['name'] + "'" );
		}
	}

	/*
	If there weren't any items that matched one list to the other, we're hosed. Just return false.
	Otherwise return an indicator that says we at least have some valid data to work with.
	*/
	if (matches == 0) {
		return false;
	}
	return true;
}

/*
HTTP request to the endpoint.
Returns a Promise object representing eventual completion/failure.
*/
function fetchData(endpoint, product_name) {

	//Different endpoint depending on whether we want all products or just one
	var url = base_url + endpoint;
	if (product_name != undefined) {
		url += "/" + product_name;
	}
	console.log("request to '" + url + "'");

	return new Promise(function(resolve, reject) {
		request(url, { json : true }, (err, res, body) => {
			if (err) { 	
				console.log(err);
				errors_list.push(err.message);
				resolve ({'status' : status_err, 'inventory' : [], 'message' : "Error on request to URL '" + url + ": " + err.message });
			}
			resolve(body);
		});
	});
}

