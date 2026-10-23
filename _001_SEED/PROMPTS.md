# SEED

## Help to create a script to load the entity "SatelliteTopology" having in count: (seeded it on Gen1)

- Use the file @_INCEPTION/_SEED/satellite_seed.json 
- The parents are satellites and for every "satellite" the children are the bands
- The property "type" match with "satellite" => "SATELITE" and "band" => "BANDS"
- For SATELITE type,  "description" property use "display_name"
- For BAND type, "description" property use "tooltip_title"

## Help to update the script seedSatelliteTopology.js in order to work with the actual "--profile terrasacha-amplify-admin" on Amplify Gen2