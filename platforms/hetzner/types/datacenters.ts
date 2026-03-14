export const HetznerDatacenters = [
    {
        description: "Nuremberg 1 virtual DC 3",
        id: 2,
        location: {
            city: "Nuremberg",
            country: "DE",
            description: "Nuremberg DC Park 1",
            id: 2,
            latitude: 49.452102,
            longitude: 11.076665,
            name: "nbg1",
            network_zone: "eu-central",
        },
        name: "nbg1-dc3",
        server_types: {
            available: [22, 23, 24, 45, 93, 94, 96, 97, 98, 99, 100, 104],
            available_for_migration: [
                22, 23, 24, 45, 93, 94, 96, 97, 98, 99, 100, 101, 104, 105, 106,
                107,
            ],
            supported: [
                22, 23, 24, 25, 26, 45, 93, 94, 95, 96, 97, 98, 99, 100, 101,
                104, 105, 106, 107,
            ],
        },
    },
    {
        description: "Helsinki 1 virtual DC 2",
        id: 3,
        location: {
            city: "Helsinki",
            country: "FI",
            description: "Helsinki DC Park 1",
            id: 3,
            latitude: 60.169855,
            longitude: 24.938379,
            name: "hel1",
            network_zone: "eu-central",
        },
        name: "hel1-dc2",
        server_types: {
            available: [
                22, 23, 24, 25, 26, 45, 93, 94, 95, 96, 97, 98, 99, 100, 101,
                104,
            ],
            available_for_migration: [
                22, 23, 24, 25, 26, 45, 93, 94, 95, 96, 97, 98, 99, 100, 101,
                104,
            ],
            supported: [
                22, 23, 24, 25, 26, 45, 93, 94, 95, 96, 97, 98, 99, 100, 101,
                104, 105, 106, 107,
            ],
        },
    },
    {
        description: "Falkenstein 1 virtual DC 14",
        id: 4,
        location: {
            city: "Falkenstein",
            country: "DE",
            description: "Falkenstein DC Park 1",
            id: 1,
            latitude: 50.47612,
            longitude: 12.370071,
            name: "fsn1",
            network_zone: "eu-central",
        },
        name: "fsn1-dc14",
        server_types: {
            available: [22, 23, 24, 25, 45, 93, 94, 96, 104],
            available_for_migration: [
                22, 23, 24, 25, 45, 93, 94, 95, 96, 97, 98, 99, 100, 101, 104,
            ],
            supported: [
                22, 23, 24, 25, 26, 45, 93, 94, 95, 96, 97, 98, 99, 100, 101,
                104, 105, 106, 107,
            ],
        },
    },
    {
        description: "Ashburn virtual DC 1",
        id: 5,
        location: {
            city: "Ashburn, VA",
            country: "US",
            description: "Ashburn, VA",
            id: 4,
            latitude: 39.045821,
            longitude: -77.487073,
            name: "ash",
            network_zone: "us-east",
        },
        name: "ash-dc1",
        server_types: {
            available: [22, 23, 24, 25, 26, 96, 97, 98, 99, 100, 101],
            available_for_migration: [
                22, 23, 24, 25, 26, 96, 97, 98, 99, 100, 101,
            ],
            supported: [22, 23, 24, 25, 26, 96, 97, 98, 99, 100, 101],
        },
    },
    {
        description: "Hillsboro virtual DC 1",
        id: 6,
        location: {
            city: "Hillsboro, OR",
            country: "US",
            description: "Hillsboro, OR",
            id: 5,
            latitude: 45.54222,
            longitude: -122.951924,
            name: "hil",
            network_zone: "us-west",
        },
        name: "hil-dc1",
        server_types: {
            available: [22, 23, 24, 25, 26, 96, 97, 98, 99, 100, 101],
            available_for_migration: [
                22, 23, 24, 25, 26, 96, 97, 98, 99, 100, 101,
            ],
            supported: [22, 23, 24, 25, 26, 96, 97, 98, 99, 100, 101],
        },
    },
    {
        description: "Singapore virtual DC 1",
        id: 7,
        location: {
            city: "Singapore",
            country: "SG",
            description: "Singapore",
            id: 6,
            latitude: 1.283333,
            longitude: 103.833333,
            name: "sin",
            network_zone: "ap-southeast",
        },
        name: "sin-dc1",
        server_types: {
            available: [22, 23, 24, 25, 26, 96, 97, 98, 99, 100, 101],
            available_for_migration: [
                22, 23, 24, 25, 26, 96, 97, 98, 99, 100, 101,
            ],
            supported: [22, 23, 24, 25, 26, 96, 97, 98, 99, 100, 101],
        },
    },
] as const;
