import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceKm,knownLocation,assertLocationMatchesForecast,assertCityCoordinates,validCoordinates} from '../src/location.mjs';

const delhi={latitude:28.6139,longitude:77.2090};
const mumbai={latitude:19.0760,longitude:72.8777};
const saved={coordinates:delhi,air:{live:true,current:{usAqi:205}}};

test('The earth-distance calculation is zero at an identical point',()=>assert.equal(distanceKm(delhi,delhi),0));
test('Delhi and Mumbai are geographically far apart',()=>assert.ok(distanceKm(delhi,mumbai)>1000));
test('Unbounded or missing coordinates cannot be trusted',()=>{assert.equal(validCoordinates(91,0),false);assert.equal(validCoordinates(0,181),false);assert.equal(distanceKm(null,delhi),Infinity);});
test('Known built-in names resolve with punctuation and case normalized',()=>assert.equal(knownLocation('NEW DELHI')?.name,'New Delhi'));
test('Known cities must match forecast coordinates',()=>{assert.equal(assertLocationMatchesForecast({city:'New Delhi'},saved),true);assert.throws(()=>assertLocationMatchesForecast({city:'Mumbai'},saved),/does not match/);});
test('Explicit coordinates must match the issued snapshot',()=>{
  assert.equal(assertLocationMatchesForecast({city:'New Delhi',...delhi},saved),true);
  assert.throws(()=>assertLocationMatchesForecast({city:'New Delhi',...mumbai},saved),/does not match/);
});
test('An unknown display label cannot establish a location without coordinates',()=>assert.throws(()=>assertLocationMatchesForecast({city:'Unverified City'},saved),/Choose a location/));
test('A custom location with matching coordinates is supported',()=>assert.equal(assertLocationMatchesForecast({city:'GPS coordinates',...delhi},saved),true));
test('Small regional coordinate shifts are tolerated but distant ones are rejected',()=>{
  assert.equal(assertLocationMatchesForecast({city:'Custom',latitude:28.620,longitude:77.212},saved),true);
  assert.throws(()=>assertLocationMatchesForecast({city:'Custom',latitude:28.70,longitude:77.50},saved),/does not match/);
});
test('City labels at forecast-fetch time must match coordinates',()=>{
  assert.equal(assertCityCoordinates('New Delhi',delhi),true);
  assert.throws(()=>assertCityCoordinates('Mumbai',delhi),/does not match/);
  assert.equal(assertCityCoordinates('Unknown Geocoded City',delhi),true);
});
