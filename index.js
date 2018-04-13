const express = require('express')
const request = require('request');

const domain = 'localhost';
const port = '3000';
const status_ok = 'OK';
const status_err = 'ERROR';

var errors_list = [];
var warnings_list = [];
 
var app = express()
app.listen(3000)

/*
Handler - get all products
async function and await operator to make sure that the fetchInventory HTTP request comes back.
Otherwise we end up with no inventory.
*/
app.get('/products', async (req, res) => {
	errors_list = [];
	warnings_list = [];

	var inv_response;
	var inv_status;
	var inv_message = '';
	var inv_list = [];
	var price_list = [];
	var master_list = [];

	console.log("request for all products");

	inv_response = await fetchInventory();
	inv_status = inv_response.status;
	if (inv_status == status_err) {
		master_list = processResults(price_list, inv_status, inv_message,inv_list);
	}
	
	inv_list = inv_response.inventory;
	price_list = queryPrice();

	master_list = processResults(price_list, inv_status, inv_message, inv_list);
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
	var inv_response;
	var inv_status;
	var inv_message = '';
	var inv_list = [];
	var price_list = [];
	var master_list = [];

	name = req.params.name; 
	console.log("request for product '" + name + "'");

	inv_response = await fetchInventory(name);
	inv_status = inv_response.status;
	if (inv_status == status_err) {
		master_list = processResults(price_list, inv_status, inv_message, inv_list);
	}
	
	inv_list = inv_response.inventory;
	price_list = queryPrice(name);

	master_list = processResults(price_list, inv_status, inv_message, inv_list, name);
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
Then hopefully pair the price list element(s) with the inventory list element(s) and return the
master_list.
*/
function processResults(price_list, inv_status, inv_message, inventory_list, name) {

	var master_list = [];

	if (validateResults(price_list, inv_status, inv_message, inventory_list, name) == false) {
		return master_list;
	}

	for (i = 0; i < price_list.length; i++) {
		for(j = 0; j < inventory_list.length; j++) {
			if (price_list[i]['name'] == inventory_list[j]['name']){
				master_list[i] = price_list[i];
				master_list[i]['quantity'] = inventory_list[j]['quantity'];
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
function validateResults(price_list, inv_status, inv_message, inventory_list, name) {

	var process_ok = true;

	/* 
	If at any point we got an error status, we can't do anything. Add the error message
	to the errors list and return a flag.
	*/
	if(inv_status == status_err) {
			errors_list.push(inv_message);
			return false;
	}
	
	/* 
	Somehow we got no prices information.
	Add a message to the errors list and set a flag; but note that we're
	going to keep going so that we can catch other errors that might be there.
	*/
	if(price_list.length == 0) {
		if (name == undefined) {
			errors_list.push('price list is empty');
		} else {
			errors_list.push("0 price entries match product name '" + name + "'");
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
	for (i = 0; i < price_list.length; i++) {
		var has_match = false;
		for(j = 0; j < inventory_list.length; j++) {
			if(inventory_list[j]['name'] == price_list[i]['name'] ) {
				matches++;
				has_match = true;
				continue;
			}
		}
		if (has_match == false) {
			warnings_list.push("no inventory entry for product '" + price_list[i]['name'] + "'" );
		}
	}

	/*
	Same thing as above, just going the other direction.
	*/
	for(i = 0; i < inventory_list.length; i++) {
		var has_match = false;
		for (j = 0; j < price_list.length; j++) {
			if(inventory_list[i]['name'] == price_list[j]['name'] ) {
				matches++;
				has_match = true;
				continue;
			}
		}
		if (has_match == false) {
			warnings_list.push("no price entry for product '" + inventory_list[i]['name'] + "'" );
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
HTTP request to the inventory endpoint.
Returns a Promise object representing eventual completion/failure.
*/
function fetchInventory(product_name) {

	//Different endpoint depending on whether we want all products or just one
	var url = "http://" + domain + ":" + port + "/inventory/";
	if (product_name != undefined) {
		url += product_name;
	}

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

/*
STUB - query db here IRL
*/
function queryInventory(product_name) {
	const inventory = [
			{'name' :'prod0', 'quantity' : 9}, 
			{'name' :'prod1' , 'quantity' : 26}, 
			{'name' :'prod22' , 'quantity' : 18}
	];

	if (product_name === undefined) {
		return inventory;
	} else {
		for (i = 0; i < inventory.length; i++) {
			if (inventory[i]['name'] == product_name) {
				return [inventory[i]];
			}
		}
		return [];
	}
}

/*
STUB - query db here IRL
*/
function queryPrice(product_name) {
	const prices = [
			{'name' :'prod0', 'price' : 1.99 }, 
			{'name' :'prod1' , 'price' : .99}, 
			{'name' :'prod2' , 'price' : .19}
	];

	if (product_name === undefined) {
		return prices;
	} else {
		for (i = 0; i < prices.length; i++) {
			if (prices[i]['name'] == product_name) {
				return [prices[i]];
			}
		}
		return [];
	}
}
